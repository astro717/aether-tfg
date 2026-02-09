import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { GithubService, CommitDiff } from '../github/github.service';

export interface TaskValidationResult {
  taskId: string;
  taskTitle: string;
  readableId: number;
  isCompliant: boolean;
  confidence: 'high' | 'medium' | 'low';
  summary: string;
  findings: string[];
  recommendations: string[];
  commitsAnalyzed: number;
}

export interface CommitExplanation {
  sha: string;
  summary: string;
  filesChanged: string[];
  impact: string;
  codeQuality: string;
}

export interface CommitInTaskContextExplanation {
  sha: string;
  taskId: string;
  taskTitle: string;
  readableId: number;
  explanation: string;
  howItFulfillsTask: string;
  remainingWork: string[];
  technicalDetails: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly geminiApiKey: string;
  private readonly geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private githubService: GithubService,
  ) {
    this.geminiApiKey = this.configService.get<string>('gemini.apiKey') || '';
    this.logger.log('AiService initialized');
  }

  /**
   * Cleans AI response by removing markdown code blocks and extracting clean JSON.
   * This handles common LLM issues like wrapping JSON in ```json ... ``` blocks,
   * adding introductory text, or including trailing commas.
   *
   * ROBUST APPROACH (per plan):
   * 1. Remove lines starting with ``` (handles missing closing backticks)
   * 2. Remove "json" keyword if it appears at the start
   * 3. Find JSON boundaries { ... }
   * 4. Fix trailing commas and other common issues
   */
  private cleanAiResponse(rawResponse: string): string {
    let cleaned = rawResponse.trim();

    // Step 1: Try to extract from complete code block first (ideal case)
    const codeBlockRegex = /```(?:json|javascript|typescript|js|ts)?\s*\n?([\s\S]*?)\n?```/gi;
    const codeBlockMatch = codeBlockRegex.exec(cleaned);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
      this.logger.debug('Extracted content from complete markdown code block');
    } else {
      // Step 1b: Fallback - Remove lines that start with ``` (handles truncated/malformed responses)
      // This handles cases where the closing ``` is missing
      cleaned = cleaned
        .split('\n')
        .filter(line => !line.trim().startsWith('```'))
        .join('\n')
        .trim();

      // Step 1c: Also remove standalone "json" at the very beginning (sometimes model outputs "json\n{...")
      cleaned = cleaned.replace(/^json\s*/i, '');

      this.logger.debug('Used fallback: removed backtick lines from response');
    }

    // Step 2: Find the JSON object boundaries (first { to last })
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      this.logger.warn('No valid JSON object boundaries found in response');
      return cleaned; // Return cleaned response as-is if no JSON found
    }

    // Extract the JSON substring
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);

    // Step 3: Fix common JSON issues
    // Remove trailing commas before } or ]
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // Remove any BOM or invisible characters
    cleaned = cleaned.replace(/^\uFEFF/, '');

    this.logger.debug(`Cleaned AI response: ${cleaned.substring(0, 100)}...`);
    return cleaned;
  }

  /**
   * Attempts to repair truncated/malformed JSON by closing unclosed brackets.
   * This handles common LLM issues like responses getting cut off mid-array/object.
   */
  private repairJson(jsonString: string): string {
    let repaired = jsonString.trim();

    // Count brackets to find imbalance
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escapeNext = false;

    for (const char of repaired) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }

    // If we're still in a string, close it
    if (inString) {
      repaired += '"';
    }

    // Remove trailing comma if present (common truncation artifact)
    repaired = repaired.replace(/,\s*$/, '');

    // Close unclosed brackets/braces
    while (openBrackets > 0) {
      repaired += ']';
      openBrackets--;
    }
    while (openBraces > 0) {
      repaired += '}';
      openBraces--;
    }

    this.logger.debug(`Repaired JSON (added ${repaired.length - jsonString.length} closing chars)`);
    return repaired;
  }

  /**
   * Safely parses JSON with the cleanAiResponse helper and repair fallback.
   * Returns null if parsing fails even after repair attempt.
   */
  private safeParseJson<T>(rawResponse: string): T | null {
    const cleaned = this.cleanAiResponse(rawResponse);

    // First attempt: parse as-is
    try {
      return JSON.parse(cleaned) as T;
    } catch (firstError) {
      this.logger.warn(`Initial JSON parse failed, attempting repair...`);

      // Second attempt: try to repair truncated JSON
      try {
        const repaired = this.repairJson(cleaned);
        const result = JSON.parse(repaired) as T;
        this.logger.log('JSON repair successful');
        return result;
      } catch (repairError) {
        this.logger.error(`JSON parse failed even after repair: ${repairError instanceof Error ? repairError.message : 'Unknown error'}`);
        this.logger.debug(`Raw response (first 500 chars): ${rawResponse.substring(0, 500)}`);
        return null;
      }
    }
  }

  /**
   * FAILSAFE PARSING: For Code Analysis - Never returns null, always provides useful content.
   * Strategy: If JSON parsing fails, extract what we can from the raw text.
   * This prevents 500 errors and shows partial analysis to the user.
   */
  private safeParseCodeAnalysis(rawResponse: string): { summary: string; score: string; issues: any[]; is_partial: boolean } {
    // First, try standard JSON parsing
    const parsed = this.safeParseJson<{ summary: string; score: string; issues: any[] }>(rawResponse);

    if (parsed && typeof parsed.summary === 'string') {
      // Validate and normalize the score
      const validScores = ['A', 'B', 'C', 'D', 'F'];
      let normalizedScore = 'C'; // Default fallback
      if (typeof parsed.score === 'string') {
        const upperScore = parsed.score.trim().toUpperCase().charAt(0);
        if (validScores.includes(upperScore)) {
          normalizedScore = upperScore;
        }
      }

      // Validate and sanitize issues array
      const validatedIssues = Array.isArray(parsed.issues)
        ? parsed.issues
            .filter(issue =>
              issue &&
              typeof issue.title === 'string' &&
              typeof issue.severity === 'string'
            )
            .map(issue => ({
              severity: ['high', 'medium', 'low'].includes(issue.severity?.toLowerCase())
                ? issue.severity.toLowerCase()
                : 'medium',
              title: issue.title,
              file: typeof issue.file === 'string' ? issue.file : 'unknown',
              line: typeof issue.line === 'number' ? issue.line : 0
            }))
        : [];

      return {
        summary: parsed.summary,
        score: normalizedScore,
        issues: validatedIssues,
        is_partial: false
      };
    }

    // FALLBACK: JSON parsing failed - extract useful content from raw text
    this.logger.warn('Code analysis JSON parsing failed, creating partial analysis from raw text');

    const cleanedText = this.cleanAiResponse(rawResponse);

    // Try to extract score using regex (e.g., "Score: A" or "Grade: B")
    let extractedScore = 'N/A';
    const scoreMatch = cleanedText.match(/(?:score|grade)\s*[:=]?\s*([A-Fa-f])/i);
    if (scoreMatch) {
      extractedScore = scoreMatch[1].toUpperCase();
    }

    // Create a useful summary from the first meaningful part of the response
    const summaryText = cleanedText
      .replace(/[{}\[\]"]/g, ' ') // Remove JSON characters
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .trim()
      .substring(0, 500);

    return {
      summary: summaryText.length > 0
        ? `AI Analysis (Partial): ${summaryText}${summaryText.length >= 500 ? '...' : ''}`
        : 'Analysis could not be fully parsed. The AI response was truncated or malformed.',
      score: extractedScore,
      issues: [],
      is_partial: true
    };
  }

  /**
   * FAILSAFE PARSING: For Task Report - Never returns null, always provides useful content.
   */
  private safeParseTaskReport(rawResponse: string): { summary: string; sections: { title: string; content: string }[]; is_partial: boolean } {
    const parsed = this.safeParseJson<{ summary: string; sections: { title: string; content: string }[] }>(rawResponse);

    if (parsed && typeof parsed.summary === 'string' && Array.isArray(parsed.sections)) {
      const validatedSections = parsed.sections
        .filter(s => s && typeof s.title === 'string' && typeof s.content === 'string')
        .map(s => ({ title: s.title, content: s.content }));

      // Ensure at least one section
      if (validatedSections.length === 0) {
        validatedSections.push({ title: 'Analysis', content: parsed.summary });
      }

      return {
        summary: parsed.summary,
        sections: validatedSections,
        is_partial: false
      };
    }

    // FALLBACK: JSON parsing failed - extract useful content from raw text
    this.logger.warn('Task report JSON parsing failed, creating partial report from raw text');

    const cleanedText = this.cleanAiResponse(rawResponse);

    // Create a useful summary from the cleaned response
    const summaryText = cleanedText
      .replace(/[{}\[\]"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 600);

    return {
      summary: summaryText.length > 0
        ? `Report (Partial): ${summaryText}${summaryText.length >= 600 ? '...' : ''}`
        : 'Report could not be fully generated. The AI response was truncated.',
      sections: [
        { title: 'Partial Analysis', content: 'The AI generated content but it could not be fully parsed. Please try regenerating the report.' }
      ],
      is_partial: true
    };
  }

  /**
   * Call Gemini API with a prompt
   */
  private async callGemini(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.geminiApiUrl}?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2, // Lower temperature for more deterministic JSON responses
            maxOutputTokens: 8192, // Increased to 8K to prevent truncation on large commits
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Gemini API error: ${error}`);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      this.logger.error('Error calling Gemini:', error);
      throw error;
    }
  }

  /**
   * Validate if commits linked to a task actually fulfill the task requirements
   */
  async validateTaskCompletion(taskId: string, user: any): Promise<TaskValidationResult> {
    // Get task with linked commits
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      include: {
        task_commits: {
          include: {
            commits: {
              include: { repos: true },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (!task.task_commits || task.task_commits.length === 0) {
      return {
        taskId: task.id,
        taskTitle: task.title,
        readableId: task.readable_id,
        isCompliant: false,
        confidence: 'high',
        summary: 'No commits linked to this task. Cannot validate completion.',
        findings: ['No commits found with task reference #' + task.readable_id],
        recommendations: ['Link commits by including #' + task.readable_id + ' in commit messages'],
        commitsAnalyzed: 0,
      };
    }

    // Fetch diffs for all linked commits
    const diffs: CommitDiff[] = [];
    for (const tc of task.task_commits) {
      const commit = tc.commits;
      if (commit.repos) {
        const match = commit.repos.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (match) {
          const [, owner, repoName] = match;
          try {
            const diff = await this.githubService.getDiff(
              owner,
              repoName.replace('.git', ''),
              commit.sha,
              user.github_access_token,
            );
            diffs.push(diff);
          } catch (error) {
            this.logger.warn(`Could not fetch diff for ${commit.sha}: ${error}`);
          }
        }
      }
    }

    // Build the AI prompt
    const prompt = this.buildValidationPrompt(task, diffs);

    // Call Gemini
    const aiResponse = await this.callGemini(prompt);

    // Parse the response
    return this.parseValidationResponse(aiResponse, task, diffs.length);
  }

  /**
   * Build a prompt for task validation
   */
  private buildValidationPrompt(task: any, diffs: CommitDiff[]): string {
    const diffSummaries = diffs.map((diff, i) => {
      const filesChanged = diff.files.map(f => `  - ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n');
      const patches = diff.files
        .filter(f => f.patch)
        .slice(0, 3) // Limit to 3 files to avoid token limits
        .map(f => `\n--- ${f.filename} ---\n${f.patch?.substring(0, 500) || 'No patch'}`)
        .join('\n');

      return `
COMMIT ${i + 1}: ${diff.sha.substring(0, 7)}
Message: ${diff.message}
Stats: +${diff.stats.additions} additions, -${diff.stats.deletions} deletions
Files changed:
${filesChanged}
Code changes (excerpt):
${patches}
`;
    }).join('\n---\n');

    return `You are a senior code reviewer analyzing if commits fulfill a task's requirements.

TASK #${task.readable_id}: "${task.title}"
Description: ${task.description || 'No description provided'}
Current Status: ${task.status}

COMMITS LINKED TO THIS TASK:
${diffSummaries}

INSTRUCTIONS:
Analyze the commits and determine if they fulfill the task requirements. Consider:
1. Does the code change address what the task title/description requests?
2. Is the implementation complete or partial?
3. Are there any obvious issues, bugs, or missing pieces?

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "isCompliant": true/false,
  "confidence": "high"/"medium"/"low",
  "summary": "One sentence summary of your analysis",
  "findings": ["Finding 1", "Finding 2", ...],
  "recommendations": ["Recommendation 1", "Recommendation 2", ...]
}`;
  }

  /**
   * Parse the AI response into a structured result
   */
  private parseValidationResponse(response: string, task: any, commitsAnalyzed: number): TaskValidationResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          taskId: task.id,
          taskTitle: task.title,
          readableId: task.readable_id,
          isCompliant: parsed.isCompliant || false,
          confidence: parsed.confidence || 'low',
          summary: parsed.summary || 'Analysis completed',
          findings: parsed.findings || [],
          recommendations: parsed.recommendations || [],
          commitsAnalyzed,
        };
      }
    } catch (error) {
      this.logger.warn('Could not parse AI response as JSON:', error);
    }

    // Fallback: return raw response as summary
    return {
      taskId: task.id,
      taskTitle: task.title,
      readableId: task.readable_id,
      isCompliant: false,
      confidence: 'low',
      summary: response.substring(0, 200),
      findings: ['Could not parse AI response'],
      recommendations: ['Please review manually'],
      commitsAnalyzed,
    };
  }

  /**
   * Generate an explanation for a specific commit
   * Implements caching strategy: Check DB first, generate if cache miss
   */
  async explainCommit(sha: string, user: any, onlyCached: boolean = false): Promise<CommitExplanation & { cached: boolean; timestamp: Date }> {
    // Step 1: Check cache in ai_reports table (get the latest one)
    const cachedReport = await this.prisma.ai_reports.findFirst({
      where: {
        commit_sha: sha,
        type: 'commit_explanation',
      },
      orderBy: { created_at: 'desc' }, // Get the most recent cache entry
    });

    // Cache Hit - Return cached result with timestamp
    if (cachedReport && cachedReport.content) {
      this.logger.log(`Cache HIT for commit ${sha.substring(0, 7)}`);
      try {
        const parsed = JSON.parse(cachedReport.content);
        return {
          sha,
          summary: parsed.summary || 'Commit analyzed',
          filesChanged: parsed.filesChanged || [],
          impact: parsed.impact || 'Unknown',
          codeQuality: parsed.codeQuality || 'Not assessed',
          cached: true,
          timestamp: cachedReport.created_at || new Date(),
        };
      } catch {
        // If cached content is not valid JSON, regenerate
        this.logger.warn(`Cached content for ${sha} is not valid JSON, regenerating...`);
      }
    }

    // If we only want cached results and it's a miss, return null or throw
    if (onlyCached) {
      throw new NotFoundException('No cached explanation found for this commit');
    }

    // Cache Miss - Generate new explanation
    this.logger.log(`Cache MISS for commit ${sha.substring(0, 7)}, generating...`);

    const commit = await this.prisma.commits.findUnique({
      where: { sha },
      include: { repos: true },
    });

    if (!commit || !commit.repos) {
      throw new NotFoundException('Commit not found');
    }

    const match = commit.repos.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new NotFoundException('Invalid repository URL');
    }

    const [, owner, repoName] = match;

    // Fetch diff from GitHub with better error handling
    let diff;
    try {
      diff = await this.githubService.getDiff(
        owner,
        repoName.replace('.git', ''),
        sha,
        user.github_access_token,
      );
    } catch (githubError) {
      this.logger.error(`GitHub API error for ${sha}:`, githubError);
      throw new NotFoundException(
        `Failed to fetch commit diff from GitHub. Ensure you have access to ${owner}/${repoName}.`
      );
    }

    const prompt = `Analyze this commit and provide a clear explanation.

COMMIT: ${sha.substring(0, 7)}
Message: ${diff.message}
Stats: +${diff.stats.additions} additions, -${diff.stats.deletions} deletions

Files changed:
${diff.files.map(f => `- ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n')}

Code changes:
${diff.files.slice(0, 3).map(f => `\n--- ${f.filename} ---\n${f.patch?.substring(0, 800) || 'No patch'}`).join('\n')}

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "summary": "Clear one-paragraph explanation of what this commit does",
  "filesChanged": ["Brief description of each file change"],
  "impact": "Description of the impact/importance of these changes",
  "codeQuality": "Brief assessment of code quality (good/needs improvement/concerns)"
}`;

    let aiResponse: string;
    try {
      aiResponse = await this.callGemini(prompt);
    } catch (aiError) {
      this.logger.error(`Gemini API error for ${sha}:`, aiError);
      throw new InternalServerErrorException(
        'AI service temporarily unavailable. Please try again later.'
      );
    }

    let result: CommitExplanation;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        result = {
          sha,
          summary: parsed.summary || 'Commit analyzed',
          filesChanged: parsed.filesChanged || [],
          impact: parsed.impact || 'Unknown',
          codeQuality: parsed.codeQuality || 'Not assessed',
        };
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (error) {
      this.logger.warn('Could not parse commit explanation:', error);
      result = {
        sha,
        summary: aiResponse.substring(0, 500),
        filesChanged: diff.files.map(f => f.filename),
        impact: 'Could not analyze',
        codeQuality: 'Not assessed',
      };
    }

    // Step 3: Save to cache (ai_reports table)
    try {
      await this.prisma.ai_reports.create({
        data: {
          commit_sha: sha,
          type: 'commit_explanation',
          content: JSON.stringify(result),
        },
      });
      this.logger.log(`Cached explanation for commit ${sha.substring(0, 7)}`);
    } catch (cacheError) {
      this.logger.warn(`Failed to cache explanation for ${sha}:`, cacheError);
    }

    return { ...result, cached: false, timestamp: new Date() };
  }

  /**
   * Explain a commit in the context of a specific task (Phase 6 - AI Prompt Design)
   * This uses the task description + commit diff to provide contextual explanation
   * NOW with caching support indexed by (task_id, commit_sha)
   */
  async explainCommitInTaskContext(
    sha: string,
    taskId: string,
    user: any,
    onlyCached: boolean = false,
    forceRegenerate: boolean = false,
  ): Promise<CommitInTaskContextExplanation & { cached: boolean; timestamp: Date }> {
    // Step 1: Check cache in ai_reports table using task_id + commit_sha + type
    // UNLESS forceRegenerate is true (for regeneration flow)
    if (!forceRegenerate) {
      const cachedReport = await this.prisma.ai_reports.findFirst({
        where: {
          task_id: taskId,
          commit_sha: sha,
          type: 'task_commit_explanation', // New type to differentiate from generic explanations
        },
        orderBy: { created_at: 'desc' },
      });

      // Cache Hit - Return cached result with timestamp
      if (cachedReport && cachedReport.content) {
        this.logger.log(`Cache HIT for task commit explanation ${taskId.substring(0, 8)}/${sha.substring(0, 7)}`);
        try {
          const parsed = JSON.parse(cachedReport.content);
          return {
            sha,
            taskId: parsed.taskId || taskId,
            taskTitle: parsed.taskTitle || '',
            readableId: parsed.readableId || 0,
            explanation: parsed.explanation || 'Commit analizado',
            howItFulfillsTask: parsed.howItFulfillsTask || 'Ver detalles del commit',
            remainingWork: parsed.remainingWork || [],
            technicalDetails: parsed.technicalDetails || 'Sin detalles técnicos',
            cached: true,
            timestamp: cachedReport.created_at || new Date(),
          };
        } catch {
          this.logger.warn(`Cached content for task ${taskId}/commit ${sha} is not valid JSON, regenerating...`);
        }
      }

      // If we only want cached results and it's a miss, throw
      if (onlyCached) {
        throw new NotFoundException('No cached explanation found for this commit in task context');
      }
    }

    // Cache Miss - Generate new contextual explanation
    this.logger.log(`Cache MISS for task commit explanation ${taskId.substring(0, 8)}/${sha.substring(0, 7)}, generating...`);

    // Get task info
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Get commit info
    const commit = await this.prisma.commits.findUnique({
      where: { sha },
      include: { repos: true },
    });

    if (!commit || !commit.repos) {
      throw new NotFoundException('Commit not found');
    }

    // Get the diff - ensuring we use the SHA from the parameter
    const match = commit.repos.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new NotFoundException('Invalid repository URL');
    }

    const [, owner, repoName] = match;

    let diff;
    try {
      diff = await this.githubService.getDiff(
        owner,
        repoName.replace('.git', ''),
        sha,
        user.github_access_token,
      );
    } catch (githubError) {
      this.logger.error(`GitHub API error for ${sha}:`, githubError);
      throw new NotFoundException(
        `Failed to fetch commit diff from GitHub. Ensure you have access to ${owner}/${repoName}.`
      );
    }

    // Build the contextual prompt (as specified in Phase 6)
    const prompt = `Explica este cambio en el contexto de la tarea.

TAREA #${task.readable_id}: "${task.title}"
Descripción de la tarea: ${task.description || 'Sin descripción proporcionada'}
Estado actual: ${task.status}

COMMIT: ${sha.substring(0, 7)}
Mensaje: ${diff.message}
Estadísticas: +${diff.stats.additions} adiciones, -${diff.stats.deletions} eliminaciones

Archivos modificados:
${diff.files.map(f => `- ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n')}

Cambios de código (extracto):
${diff.files.slice(0, 4).map(f => `\n--- ${f.filename} ---\n${f.patch?.substring(0, 600) || 'Sin patch disponible'}`).join('\n')}

INSTRUCCIONES:
Analiza cómo este commit contribuye a completar la tarea. Considera:
1. ¿Qué hace específicamente este commit?
2. ¿Cómo ayuda a cumplir los requisitos de la tarea?
3. ¿Queda trabajo pendiente para completar la tarea?
4. Detalles técnicos relevantes del cambio.

Responde en este formato JSON exacto (sin markdown, solo JSON puro):
{
  "explanation": "Explicación clara de lo que hace este commit en 2-3 oraciones",
  "howItFulfillsTask": "Cómo este commit contribuye a completar la tarea #${task.readable_id}",
  "remainingWork": ["Trabajo pendiente 1", "Trabajo pendiente 2"],
  "technicalDetails": "Resumen técnico de los cambios implementados"
}`;

    let aiResponse: string;
    try {
      aiResponse = await this.callGemini(prompt);
    } catch (aiError) {
      this.logger.error(`Gemini API error for ${sha}:`, aiError);
      throw new InternalServerErrorException(
        'AI service temporarily unavailable. Please try again later.'
      );
    }

    let result: CommitInTaskContextExplanation;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        result = {
          sha,
          taskId: task.id,
          taskTitle: task.title,
          readableId: task.readable_id,
          explanation: parsed.explanation || 'Commit analizado',
          howItFulfillsTask: parsed.howItFulfillsTask || 'Ver detalles del commit',
          remainingWork: parsed.remainingWork || [],
          technicalDetails: parsed.technicalDetails || 'Sin detalles técnicos',
        };
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (error) {
      this.logger.warn('Could not parse contextual commit explanation:', error);
      result = {
        sha,
        taskId: task.id,
        taskTitle: task.title,
        readableId: task.readable_id,
        explanation: aiResponse.substring(0, 500),
        howItFulfillsTask: 'No se pudo determinar',
        remainingWork: ['Revisión manual requerida'],
        technicalDetails: `Archivos modificados: ${diff.files.map(f => f.filename).join(', ')}`,
      };
    }

    // Step 3: Save to cache (ai_reports table) with task_id + commit_sha + type
    try {
      await this.prisma.ai_reports.create({
        data: {
          task_id: taskId,
          commit_sha: sha,
          type: 'task_commit_explanation',
          content: JSON.stringify(result),
        },
      });
      this.logger.log(`Cached task commit explanation for ${taskId.substring(0, 8)}/${sha.substring(0, 7)}`);
    } catch (cacheError) {
      this.logger.warn(`Failed to cache task commit explanation for ${taskId}/${sha}:`, cacheError);
    }

    return { ...result, cached: false, timestamp: new Date() };
  }
  /**
   * Analyze code quality and vulnerabilities for a specific commit
   * Implements caching strategy with force regeneration support
   * @param sha - Commit SHA to analyze
   * @param user - Current user (for GitHub access)
   * @param onlyCached - Only return cached results (404 if not cached)
   * @param forceRegenerate - Skip cache and regenerate (deletes old reports)
   */
  async analyzeCode(sha: string, user: any, onlyCached: boolean = false, forceRegenerate: boolean = false): Promise<any> {
    // Step 1: If forceRegenerate, delete old reports first (Clean Slate approach)
    if (forceRegenerate) {
      this.logger.log(`Force regenerate requested for code analysis ${sha.substring(0, 7)}, deleting old reports...`);
      await this.prisma.ai_reports.deleteMany({
        where: {
          commit_sha: sha,
          type: 'code_analysis',
        },
      });
    }

    // Step 2: Check cache (unless forceRegenerate is true)
    if (!forceRegenerate) {
      const cachedReport = await this.prisma.ai_reports.findFirst({
        where: {
          commit_sha: sha,
          type: 'code_analysis',
        },
        orderBy: { created_at: 'desc' },
      });

      if (cachedReport && cachedReport.content) {
        this.logger.log(`Cache HIT for code analysis ${sha.substring(0, 7)}`);
        try {
          const parsed = JSON.parse(cachedReport.content);
          return { ...parsed, cached: true, timestamp: cachedReport.created_at };
        } catch {
          this.logger.warn(`Cached analysis for ${sha} is invalid JSON`);
        }
      }

      if (onlyCached) {
        throw new NotFoundException('No cached analysis found');
      }
    }

    // Cache Miss - Generate
    this.logger.log(`Cache MISS for code analysis ${sha.substring(0, 7)}, generating...`);

    // Fetch commit and diff (reuse existing logic if possible, or duplicate for now to be safe)
    const commit = await this.prisma.commits.findUnique({ where: { sha }, include: { repos: true } });
    if (!commit || !commit.repos) throw new NotFoundException('Commit not found');

    const match = commit.repos.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new NotFoundException('Invalid repo URL');
    const [, owner, repoName] = match;

    let diff;
    try {
      diff = await this.githubService.getDiff(owner, repoName.replace('.git', ''), sha, user.github_access_token);
    } catch (githubError) {
      this.logger.error(`GitHub API error while fetching diff for ${sha}:`, githubError);
      // Provide user-friendly error message for GitHub API failures
      const errorMessage = githubError instanceof Error ? githubError.message : 'Unknown error';
      if (errorMessage.includes('503') || errorMessage.includes('No server is currently available')) {
        throw new InternalServerErrorException('GitHub is temporarily unavailable. Please try again in a few moments.');
      }
      throw new InternalServerErrorException(`Failed to fetch commit from GitHub: ${errorMessage}`);
    }

    const prompt = `You are a security analyst. Analyze this code for vulnerabilities and quality issues.

COMMIT: ${sha.substring(0, 7)}
Message: ${diff.message}
Changes:
${diff.files.slice(0, 5).map(f => `\n--- ${f.filename} ---\n${f.patch?.substring(0, 1000) || 'No patch'}`).join('\n')}

ANALYSIS REQUIREMENTS:
1. Identify security vulnerabilities (injection, XSS, auth issues, etc.)
2. Check for code quality issues (error handling, input validation)
3. Assign a letter grade based on overall security posture

CRITICAL OUTPUT INSTRUCTIONS:
- Return ONLY a raw JSON object, nothing else
- Do NOT wrap the response in markdown code blocks (no \`\`\`json or \`\`\`)
- Do NOT include any text before or after the JSON
- The response must start with { and end with }
- The "score" field must be exactly ONE uppercase letter: A, B, C, D, or F
- If no issues found, use an empty array for "issues"

Required JSON structure:
{"summary":"Brief summary of findings","score":"A","issues":[{"severity":"high","title":"Issue title","file":"filename.ts","line":123}]}`;

    const aiResponse = await this.callGemini(prompt);

    // Use FAILSAFE parsing - never returns null, always provides useful content
    const result = this.safeParseCodeAnalysis(aiResponse);

    this.logger.log(`Code analysis for ${sha.substring(0, 7)} - Score: ${result.score}, Partial: ${result.is_partial}`);

    // Only cache successful (non-partial) results to prevent "ghost regeneration"
    if (!result.is_partial) {
      await this.prisma.ai_reports.create({
        data: {
          commit_sha: sha,
          type: 'code_analysis',
          content: JSON.stringify({ summary: result.summary, score: result.score, issues: result.issues }),
        },
      });
      this.logger.log(`Cached code analysis for ${sha.substring(0, 7)}`);
    } else {
      this.logger.warn(`Skipping cache for partial code analysis ${sha.substring(0, 7)} - user can retry`);
    }

    return { summary: result.summary, score: result.score, issues: result.issues, cached: false, timestamp: new Date() };
  }

  /**
   * Generate a comprehensive task report based on task status, comments, and commits
   * NOW includes the specific commit's diff to make the report contextual to the selected commit
   *
   * @param forceRegenerate - When true, deletes existing cached reports and generates fresh
   *                          This fixes the "ghost regeneration" bug where cached errors persisted
   */
  async generateTaskReport(
    taskId: string,
    commitSha: string | null,
    user: any,
    onlyCached: boolean = false,
    forceRegenerate: boolean = false,
  ): Promise<any> {
    if (!commitSha) {
      throw new Error('Commit SHA is required for indexing the report');
    }

    // STEP 1: If forceRegenerate, delete old cached reports first (Clean Slate approach)
    if (forceRegenerate) {
      this.logger.log(`Force regenerate requested for task report ${taskId.substring(0, 8)}/${commitSha.substring(0, 7)}, deleting old reports...`);
      await this.prisma.ai_reports.deleteMany({
        where: {
          task_id: taskId,
          commit_sha: commitSha,
          type: 'task_report',
        },
      });
    }

    // STEP 2: Check cache (unless forceRegenerate is true)
    if (!forceRegenerate) {
      const cachedReport = await this.prisma.ai_reports.findFirst({
        where: {
          task_id: taskId,
          commit_sha: commitSha,
          type: 'task_report',
        },
        orderBy: { created_at: 'desc' },
      });

      if (cachedReport && cachedReport.content) {
        this.logger.log(`Cache HIT for task report ${taskId.substring(0, 8)}/${commitSha.substring(0, 7)}`);
        try {
          const parsed = JSON.parse(cachedReport.content);
          return { ...parsed, cached: true, timestamp: cachedReport.created_at };
        } catch {
          this.logger.warn(`Cached report for task ${taskId} is invalid JSON`);
        }
      }

      if (onlyCached) {
        this.logger.log(`Cache MISS for task report ${taskId.substring(0, 8)}/${commitSha.substring(0, 7)}`);
        throw new NotFoundException('No cached report found');
      }
    }

    // Generate - Fetch task with all linked commits
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      include: { task_commits: { include: { commits: { include: { repos: true } } } } }
    });
    if (!task) throw new NotFoundException('Task not found');

    // Fetch the specific commit to get the diff for this snapshot
    const commit = await this.prisma.commits.findUnique({
      where: { sha: commitSha },
      include: { repos: true }
    });
    if (!commit || !commit.repos) {
      throw new NotFoundException('Commit not found or repository info missing');
    }

    // Extract repo info and fetch diff for the selected commit
    const match = commit.repos.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new NotFoundException('Invalid repository URL');
    }
    const [, owner, repoName] = match;

    let diff: CommitDiff;
    try {
      diff = await this.githubService.getDiff(
        owner,
        repoName.replace('.git', ''),
        commitSha,
        user.github_access_token,
      );
    } catch (error) {
      this.logger.error(`Failed to fetch diff for commit ${commitSha}:`, error);
      throw new NotFoundException('Failed to fetch commit diff from GitHub');
    }

    // Build a comprehensive prompt that includes the specific commit's changes
    const filesChangedSummary = diff.files.map(f => `  - ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n');
    const codeExcerpts = diff.files
      .slice(0, 4) // Include up to 4 files
      .map(f => `\n--- ${f.filename} ---\n${f.patch?.substring(0, 800) || 'No patch available'}`)
      .join('\n');

    const prompt = `You are a technical analyst. Generate a progress report for this task at commit ${commitSha.substring(0, 7)}.

TASK #${task.readable_id}: ${task.title}
Status: ${task.status}
Description: ${task.description || 'No description provided'}
Total Commits Linked: ${task.task_commits?.length || 0}

SELECTED COMMIT SNAPSHOT: ${commitSha.substring(0, 7)}
Commit Message: ${diff.message}
Stats: +${diff.stats.additions} additions, -${diff.stats.deletions} deletions

Files Changed:
${filesChangedSummary}

Code Changes (excerpt):
${codeExcerpts}

ANALYSIS REQUIREMENTS:
1. What work was completed in this commit
2. How it relates to the task requirements
3. Code quality and implementation approach
4. What might remain to be done

CRITICAL OUTPUT INSTRUCTIONS:
- Return ONLY a raw JSON object, nothing else
- Do NOT wrap the response in markdown code blocks (no \`\`\`json or \`\`\`)
- Do NOT include any text before or after the JSON
- The response must start with { and end with }

Required JSON structure:
{"summary":"Executive summary (2-3 sentences)","sections":[{"title":"Changes in This Commit","content":"Detailed explanation"},{"title":"Task Progress Assessment","content":"Completion assessment"},{"title":"Technical Observations","content":"Code quality notes"}]}`;

    const aiResponse = await this.callGemini(prompt);

    // Use FAILSAFE parsing - never returns null, always provides useful content
    const result = this.safeParseTaskReport(aiResponse);

    this.logger.log(`Task report for ${taskId.substring(0, 8)}/${commitSha.substring(0, 7)} - Partial: ${result.is_partial}`);

    // CRITICAL: Only cache successful (non-partial) results to prevent "ghost regeneration"
    // If we cache an error/partial result, the user clicking "Regenerate" would get the cached error
    if (!result.is_partial) {
      await this.prisma.ai_reports.create({
        data: {
          task_id: taskId,
          commit_sha: commitSha,
          type: 'task_report',
          content: JSON.stringify({ summary: result.summary, sections: result.sections })
        }
      });
      this.logger.log(`Cached task report for ${taskId.substring(0, 8)}/${commitSha.substring(0, 7)}`);
    } else {
      this.logger.warn(`Skipping cache for partial task report ${taskId.substring(0, 8)}/${commitSha.substring(0, 7)} - user can retry`);
    }

    return { summary: result.summary, sections: result.sections, cached: false, timestamp: new Date() };
  }
}
