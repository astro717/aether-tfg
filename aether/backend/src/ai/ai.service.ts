import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { GithubService, CommitDiff } from '../github/github.service';

export interface TaskValidationResult {
  taskId: string;
  taskTitle: string;
  readableId: string;
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
  readableId: string;
  explanation: string;
  howItFulfillsTask: string;
  remainingWork: string[];
  technicalDetails: string;
}

// Language code to full name mapping for prompt injection
const LANGUAGE_MAP: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  zh: 'Chinese',
  ja: 'Japanese',
};

// Depth instructions for controlling analysis verbosity
const DEPTH_INSTRUCTIONS: Record<string, { explanation: string; codeAnalysis: string }> = {
  concise: {
    explanation: 'Be extremely concise. Use bullet points where possible. Focus only on the most critical changes. Limit summary to 1-2 sentences maximum. Omit minor details.',
    codeAnalysis: 'Be extremely concise. Report only HIGH severity security issues. Skip minor code quality concerns. Limit summary to 1 sentence.',
  },
  standard: {
    explanation: 'Provide a balanced analysis with moderate detail. Include key changes and their implications.',
    codeAnalysis: 'Provide a balanced security analysis. Report HIGH and MEDIUM severity issues. Include brief recommendations.',
  },
  detailed: {
    explanation: 'Provide a comprehensive technical analysis. Explain the "why" behind changes in depth. Include implementation details and architectural implications. Discuss potential edge cases or considerations.',
    codeAnalysis: 'Provide a comprehensive security analysis. Report ALL severity levels including LOW. Include detailed recommendations and code snippets to illustrate issues. Suggest refactoring opportunities.',
  },
};

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
   * @param language - Output language code (en, es, fr, de, pt, zh, ja)
   * @param depth - Analysis depth (concise, standard, detailed)
   */
  async explainCommitInTaskContext(
    sha: string,
    taskId: string,
    user: any,
    onlyCached: boolean = false,
    forceRegenerate: boolean = false,
    language: string = 'en',
    depth: string = 'standard',
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

    // Build the contextual prompt with dynamic language and depth support
    const languageName = LANGUAGE_MAP[language] || 'English';
    const depthInstruction = DEPTH_INSTRUCTIONS[depth]?.explanation || DEPTH_INSTRUCTIONS.standard.explanation;
    const prompt = `You are a code analyst. Explain this change in the context of the task.
IMPORTANT: Respond entirely in ${languageName} language.
DEPTH LEVEL: ${depthInstruction}

TASK #${task.readable_id}: "${task.title}"
Task description: ${task.description || 'No description provided'}
Current status: ${task.status}

COMMIT: ${sha.substring(0, 7)}
Message: ${diff.message}
Stats: +${diff.stats.additions} additions, -${diff.stats.deletions} deletions

Files changed:
${diff.files.map(f => `- ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n')}

Code changes (excerpt):
${diff.files.slice(0, 4).map(f => `\n--- ${f.filename} ---\n${f.patch?.substring(0, 600) || 'No patch available'}`).join('\n')}

INSTRUCTIONS:
Analyze how this commit contributes to completing the task. Consider:
1. What does this commit specifically do?
2. How does it help fulfill the task requirements?
3. What work remains to complete the task?
4. Relevant technical details of the change.

CRITICAL: All text content in your response MUST be written in ${languageName}.
CRITICAL: Follow the DEPTH LEVEL instruction for verbosity.

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "explanation": "Clear explanation of what this commit does (in ${languageName})",
  "howItFulfillsTask": "How this commit contributes to completing task #${task.readable_id} (in ${languageName})",
  "remainingWork": ["Remaining work 1 (in ${languageName})", "Remaining work 2 (in ${languageName})"],
  "technicalDetails": "Technical summary of the implemented changes (in ${languageName})"
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
   * @param language - Output language code (en, es, fr, de, pt, zh, ja)
   * @param depth - Analysis depth (concise, standard, detailed)
   */
  async analyzeCode(sha: string, user: any, onlyCached: boolean = false, forceRegenerate: boolean = false, language: string = 'en', depth: string = 'standard'): Promise<any> {
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

    const languageName = LANGUAGE_MAP[language] || 'English';
    const depthInstruction = DEPTH_INSTRUCTIONS[depth]?.codeAnalysis || DEPTH_INSTRUCTIONS.standard.codeAnalysis;
    const prompt = `You are a security analyst. Analyze this code for vulnerabilities and quality issues.
IMPORTANT: All text content in your response MUST be written in ${languageName} language.
DEPTH LEVEL: ${depthInstruction}

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
- The "summary" and "title" fields MUST be written in ${languageName}
- Follow the DEPTH LEVEL instruction for verbosity and issue severity filtering

Required JSON structure:
{"summary":"Brief summary of findings (in ${languageName})","score":"A","issues":[{"severity":"high","title":"Issue title (in ${languageName})","file":"filename.ts","line":123}]}`;

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

  /**
   * HELPER: Get Time Buckets for Period-Aware Visualizations
   * Returns an array of timestamps/labels based on the selected period
   * @param period - 'today' | 'week' | 'month' | 'quarter' | 'all'
   */
  private getTimeBuckets(period: string): { timestamps: Date[]; labels: string[]; granularity: string } {
    const now = new Date();
    const timestamps: Date[] = [];
    const labels: string[] = [];
    let granularity = 'day';

    switch (period) {
      case 'today':
        // Hourly buckets (last 24 hours: 00:00, 01:00, ..., 23:00)
        granularity = 'hour';
        for (let hour = 0; hour < 24; hour++) {
          const bucket = new Date(now);
          bucket.setHours(hour, 0, 0, 0);
          timestamps.push(bucket);
          labels.push(`${hour.toString().padStart(2, '0')}:00`);
        }
        break;

      case 'week':
        // Daily buckets (last 7 days: Mon, Tue, Wed, ...)
        granularity = 'day';
        for (let i = 6; i >= 0; i--) {
          const bucket = new Date(now);
          bucket.setDate(bucket.getDate() - i);
          bucket.setHours(0, 0, 0, 0);
          timestamps.push(bucket);
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          labels.push(dayNames[bucket.getDay()]);
        }
        break;

      case 'month':
        // Daily buckets (last 30 days: 1, 5, 10, 15, 20, 25, 30)
        granularity = 'day';
        for (let i = 29; i >= 0; i--) {
          const bucket = new Date(now);
          bucket.setDate(bucket.getDate() - i);
          bucket.setHours(0, 0, 0, 0);
          timestamps.push(bucket);
          labels.push(`${bucket.getMonth() + 1}/${bucket.getDate()}`);
        }
        break;

      case 'quarter':
        // Weekly buckets (last ~13 weeks: Week 1, Week 2, ...)
        granularity = 'week';
        for (let i = 12; i >= 0; i--) {
          const bucket = new Date(now);
          bucket.setDate(bucket.getDate() - (i * 7));
          bucket.setHours(0, 0, 0, 0);
          timestamps.push(bucket);
          labels.push(`W${13 - i}`);
        }
        break;

      case 'all':
      default:
        // Monthly buckets (last 12 months)
        granularity = 'month';
        for (let i = 11; i >= 0; i--) {
          const bucket = new Date(now);
          bucket.setMonth(bucket.getMonth() - i);
          bucket.setDate(1);
          bucket.setHours(0, 0, 0, 0);
          timestamps.push(bucket);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          labels.push(monthNames[bucket.getMonth()]);
        }
        break;
    }

    return { timestamps, labels, granularity };
  }

  /**
   * HELPER: Calculate Investment Profile - Classifies tasks by type
   * Analyzes task titles/descriptions to infer: Feature, Bug, Chore
   * @param tasks - Array of tasks to analyze
   * @param userId - Optional user ID to filter tasks for individual analysis
   */
  private calculateInvestmentProfile(tasks: any[], userId?: string): {
    labels: string[];
    datasets: Array<{ label: string; data: number[]; color: string }>;
  } {
    // Filter tasks by user if userId is provided
    const filteredTasks = userId
      ? tasks.filter(t => t.assignee_id === userId)
      : tasks;

    const categories = { features: 0, bugs: 0, chores: 0 };

    for (const task of filteredTasks) {
      const text = `${task.title} ${task.description || ''}`.toLowerCase();
      if (text.match(/\b(fix|bug|issue|error|defect)\b/)) {
        categories.bugs++;
      } else if (text.match(/\b(feat|feature|add|new|implement|create)\b/)) {
        categories.features++;
      } else {
        categories.chores++;
      }
    }

    const total = filteredTasks.length || 1;
    return {
      labels: ['Features', 'Bugs', 'Chores'],
      datasets: [
        {
          label: 'Task Distribution',
          data: [
            Math.round((categories.features / total) * 100),
            Math.round((categories.bugs / total) * 100),
            Math.round((categories.chores / total) * 100),
          ],
          color: '#8b5cf6', // Purple
        },
      ],
    };
  }

  /**
   * HELPER: Calculate AI Risk Score (0-100)
   * Algorithm: Based on % completion vs time remaining + blockers + overdue
   * Higher score = Higher risk of delays
   */
  private calculateRiskScore(tasks: any[], organizationId: string): number {
    const now = Date.now();

    // Factor 1: Tasks with due dates approaching or overdue
    const tasksWithDueDate = tasks.filter(t => t.due_date && t.status !== 'done');
    const overdueTasks = tasksWithDueDate.filter(t => new Date(t.due_date).getTime() < now);
    const approachingDeadline = tasksWithDueDate.filter(t => {
      const daysUntilDue = (new Date(t.due_date).getTime() - now) / (1000 * 60 * 60 * 24);
      return daysUntilDue > 0 && daysUntilDue <= 7;
    });

    // Factor 2: WIP (Work In Progress) saturation
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const pendingValidation = tasks.filter(t => t.status === 'pending_validation').length;
    const totalActive = inProgress + pendingValidation;
    const wipSaturation = Math.min(100, (totalActive / Math.max(tasks.length * 0.3, 1)) * 100);

    // Factor 3: Completion rate
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const completionRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 100;
    const completionRisk = 100 - completionRate;

    // Calculate weighted risk score
    const overdueWeight = overdueTasks.length * 15; // Each overdue task adds 15 points
    const approachingWeight = approachingDeadline.length * 8; // Each approaching deadline adds 8 points
    const wipWeight = wipSaturation * 0.3; // WIP saturation contributes 30%
    const completionWeight = completionRisk * 0.4; // Completion risk contributes 40%

    const riskScore = Math.min(100, overdueWeight + approachingWeight + wipWeight + completionWeight);

    return Math.round(riskScore);
  }

  /**
   * HELPER: Calculate DORA Metrics Lite + Sparklines for Velocity
   * - Deployment Frequency: Commits/PRs merged (approximation)
   * - Lead Time: Average time from creation to done
   * - Velocity Stability: Standard deviation of weekly completion
   */
  private calculateDoraMetrics(tasks: any[]): {
    deploymentFrequency: number;
    leadTimeAvg: number;
    velocityStability: number;
    sparklineData: number[];
    cycleTimeSparkline: number[];
    reviewEfficiencySparkline: number[];
  } {
    const completedTasks = tasks.filter(t => t.status === 'done');
    const deploymentFrequency = completedTasks.length;

    // Calculate lead time (days from created_at to when status became 'done')
    const leadTimes = completedTasks
      .filter(t => t.created_at)
      .map(t => {
        // Approximation: use created_at to now (ideally we'd track status change timestamps)
        const created = new Date(t.created_at).getTime();
        const now = Date.now();
        return (now - created) / (1000 * 60 * 60 * 24); // days
      });

    const leadTimeAvg = leadTimes.length > 0
      ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
      : 0;

    // Velocity Stability: Calculate weekly completion variance
    const weeklyCounts: number[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekTasks = completedTasks.filter(t => {
        if (!t.created_at) return false;
        const taskDate = new Date(t.created_at);
        return taskDate >= weekStart && taskDate < weekEnd;
      });
      weeklyCounts.push(weekTasks.length);
    }

    const mean = weeklyCounts.reduce((a, b) => a + b, 0) / weeklyCounts.length;
    const variance = weeklyCounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / weeklyCounts.length;
    const stdDev = Math.sqrt(variance);
    const velocityStability = mean > 0 ? Math.round((1 - stdDev / mean) * 100) : 50; // Higher = more stable

    // Sparklines
    const sparklineData = weeklyCounts.slice(-10);
    const cycleTimeSparkline = leadTimes.slice(-10);

    // Review Efficiency: Approximate time in pending_validation
    const pendingTasks = tasks.filter(t => t.status === 'pending_validation');
    const reviewEfficiencySparkline = pendingTasks.slice(-10).map(t => {
      const created = new Date(t.created_at).getTime();
      const now = Date.now();
      return (now - created) / (1000 * 60 * 60); // hours
    });

    return {
      deploymentFrequency,
      leadTimeAvg,
      velocityStability,
      sparklineData,
      cycleTimeSparkline,
      reviewEfficiencySparkline,
    };
  }

  /**
   * HELPER: Generate Smooth Cumulative Flow Diagram Data (Period-Aware)
   * Reconstructs historical state distribution with CUMULATIVE stacking
   * Uses monotone interpolation for smooth curves (handled by Recharts)
   * @param period - 'today' | 'week' | 'month' | 'quarter' | 'all'
   * NOTE: This is an approximation based on current data. Ideally needs a task_history table.
   */
  private generateSmoothCFD(tasks: any[], period: string = 'week'): Array<{
    date: string;
    done: number;
    review: number;
    in_progress: number;
    todo: number;
  }> {
    const { timestamps } = this.getTimeBuckets(period);
    const data: Array<{ date: string; done: number; review: number; in_progress: number; todo: number }> = [];

    const totalBuckets = timestamps.length;

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];

      // Use ISO string for today (hourly), otherwise use date only
      const dateStr = period === 'today'
        ? timestamp.toISOString()
        : timestamp.toISOString().split('T')[0];

      // Simulate progress over time (progressFactor increases as we approach current time)
      const progressFactor = i / Math.max(totalBuckets - 1, 1);

      // Calculate cumulative values (bottom to top stacking)
      const doneCount = Math.round(tasks.filter(t => t.status === 'done').length * progressFactor);
      const reviewCount = Math.round(tasks.filter(t => t.status === 'pending_validation').length * progressFactor);
      const inProgressCount = Math.round(tasks.filter(t => t.status === 'in_progress').length * progressFactor);
      const todoCount = Math.round(tasks.filter(t => t.status === 'todo').length * (1 - progressFactor * 0.5));

      data.push({
        date: dateStr,
        done: doneCount,
        review: reviewCount,
        in_progress: inProgressCount,
        todo: todoCount,
      });
    }

    return data;
  }

  /**
   * HELPER: Analyze Workload Heatmap (GitHub-style, Period-Aware)
   * Generates a matrix of activity intensity per user per time period
   * @param organizationId - Organization to analyze
   * @param tasks - Array of tasks
   * @param period - 'today' | 'week' | 'month' | 'quarter' | 'all'
   */
  private async analyzeWorkloadHeatmap(organizationId: string, tasks: any[], period: string = 'week'): Promise<{
    users: string[];
    days: string[];
    data: number[][];
  }> {
    // Get all team members
    const teamMembers = await this.prisma.user_organizations.findMany({
      where: { organization_id: organizationId },
      include: {
        users: {
          select: { id: true, username: true, github_login: true },
        },
      },
    });

    // Get recent commits for activity tracking
    const commits = await this.prisma.commits.findMany({
      where: {
        repos: {
          organization_id: organizationId,
        },
      },
      take: 500,
      orderBy: { committed_at: 'desc' },
    });

    // Get period-aware time buckets
    const { timestamps, labels, granularity } = this.getTimeBuckets(period);
    const days: string[] = [];

    // Format labels based on granularity
    for (let i = 0; i < timestamps.length; i++) {
      if (granularity === 'hour') {
        days.push(labels[i]);
      } else if (granularity === 'day') {
        days.push(timestamps[i].toISOString().split('T')[0]);
      } else {
        days.push(labels[i]);
      }
    }

    // Build heatmap matrix
    const users: string[] = [];
    const data: number[][] = [];

    for (const member of teamMembers) {
      if (!member.users) continue;

      users.push(member.users.username);
      const userActivity: number[] = [];

      for (let i = 0; i < timestamps.length; i++) {
        const bucketStart = timestamps[i];
        const bucketEnd = new Date(bucketStart);

        // Determine bucket end based on granularity
        if (granularity === 'hour') {
          bucketEnd.setHours(bucketEnd.getHours() + 1);
        } else if (granularity === 'day') {
          bucketEnd.setDate(bucketEnd.getDate() + 1);
        } else if (granularity === 'week') {
          bucketEnd.setDate(bucketEnd.getDate() + 7);
        } else if (granularity === 'month') {
          bucketEnd.setMonth(bucketEnd.getMonth() + 1);
        }

        // Count commits for this user in this bucket
        const userCommits = commits.filter(c => {
          if (!member.users?.github_login || !c.committed_at) return false;
          const commitDate = new Date(c.committed_at);
          return (
            c.author_login === member.users.github_login &&
            commitDate >= bucketStart &&
            commitDate < bucketEnd
          );
        });

        // Count task movements (approximation: tasks assigned to this user)
        const userTasks = tasks.filter(t => {
          if (t.assignee_id !== member.users?.id) return false;
          if (!t.created_at) return false;
          const taskDate = new Date(t.created_at);
          return taskDate >= bucketStart && taskDate < bucketEnd;
        });

        // Activity score: commits + task movements (weighted)
        const activityScore = userCommits.length * 3 + userTasks.length * 2;
        userActivity.push(activityScore);
      }

      data.push(userActivity);
    }

    return { users, days, data };
  }

  /**
   * HELPER: Project Burndown with Uncertainty Cone (Period-Aware)
   * Generates predictive burndown chart with optimistic/pessimistic scenarios
   * @param tasks - Array of tasks to analyze
   * @param period - 'today' | 'week' | 'month' | 'quarter' | 'all'
   */
  private projectBurndownCone(tasks: any[], period: string = 'week'): {
    real: Array<{ day: number; tasks: number }>;
    ideal: Array<{ day: number; tasks: number }>;
    projection: Array<{ day: number; optimistic: number; pessimistic: number }>;
  } {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const remainingTasks = totalTasks - completedTasks;

    // Determine historical and projection periods based on selected period
    let historicalPeriods = 14;
    let projectionPeriods = 14;

    switch (period) {
      case 'today':
        historicalPeriods = 12;
        projectionPeriods = 12;
        break;
      case 'week':
        historicalPeriods = 7;
        projectionPeriods = 7;
        break;
      case 'month':
        historicalPeriods = 15;
        projectionPeriods = 15;
        break;
      case 'quarter':
        historicalPeriods = 13;
        projectionPeriods = 13;
        break;
      case 'all':
        historicalPeriods = 12;
        projectionPeriods = 6;
        break;
    }

    // Calculate historical burndown
    const real: Array<{ day: number; tasks: number }> = [];

    for (let i = historicalPeriods - 1; i >= 0; i--) {
      const progressFactor = i / historicalPeriods;
      const tasksRemaining = Math.round(remainingTasks + completedTasks * progressFactor);

      real.push({ day: historicalPeriods - i - 1, tasks: tasksRemaining });
    }

    // Calculate ideal burndown (straight line from current to zero)
    const ideal: Array<{ day: number; tasks: number }> = [];
    for (let day = 0; day <= projectionPeriods; day++) {
      const tasksLeft = Math.round(remainingTasks * (1 - day / projectionPeriods));
      ideal.push({ day: historicalPeriods + day - 1, tasks: tasksLeft });
    }

    // Calculate projection cone (optimistic and pessimistic scenarios)
    const projection: Array<{ day: number; optimistic: number; pessimistic: number }> = [];

    const avgVelocity = real.length > 1
      ? (real[0].tasks - real[real.length - 1].tasks) / real.length
      : 1;

    const optimisticVelocity = avgVelocity * 1.3;
    const pessimisticVelocity = avgVelocity * 0.7;

    for (let day = historicalPeriods - 1; day < historicalPeriods + projectionPeriods; day++) {
      const periodsAhead = day - (historicalPeriods - 1);
      const optimisticRemaining = Math.max(0, remainingTasks - optimisticVelocity * periodsAhead);
      const pessimisticRemaining = Math.max(0, remainingTasks - pessimisticVelocity * periodsAhead);

      projection.push({
        day,
        optimistic: Math.round(optimisticRemaining),
        pessimistic: Math.round(pessimisticRemaining),
      });
    }

    return { real, ideal, projection };
  }

  /**
   * HELPER: Calculate Radar Metrics for Code Review
   * Analyzes commit and PR data (if available)
   * @param organizationId - Organization ID to fetch commits from
   * @param userId - Optional user ID to calculate individual metrics
   */
  private async calculateRadarMetrics(organizationId: string, userId?: string): Promise<{
    user: string;
    metrics: {
      reviewSpeed: number;
      codeQuality: number;
      collaboration: number;
      throughput: number;
      consistency: number;
    };
  }> {
    // Fetch recent commits for the organization
    const allCommits = await this.prisma.commits.findMany({
      where: {
        repos: {
          organization_id: organizationId,
        },
      },
      take: 100,
      orderBy: { committed_at: 'desc' },
    });

    // If userId is provided, filter commits by that user
    let commits = allCommits;
    let userName = 'Team Average';

    if (userId) {
      // Fetch user info
      const user = await this.prisma.users.findUnique({
        where: { id: userId },
        select: { username: true, github_login: true },
      });

      if (user) {
        userName = user.username;
        // Filter commits by github login
        if (user.github_login) {
          commits = allCommits.filter(c => c.author_login === user.github_login);
        }
      }
    }

    // Calculate metrics (0-100 scale)
    const reviewSpeed = Math.min(100, commits.length * 2); // More commits = faster
    const codeQuality = 75; // Placeholder - would analyze code_analysis scores
    const collaboration = Math.min(100, new Set(commits.map(c => c.author_login)).size * 10);
    const throughput = Math.min(100, commits.length);
    const consistency = 80; // Placeholder - would analyze commit frequency variance

    return {
      user: userName,
      metrics: { reviewSpeed, codeQuality, collaboration, throughput, consistency },
    };
  }

  /**
   * HELPER: Calculate Cycle Time Scatterplot Data
   * X-axis: Date, Y-axis: Days to complete
   * @param tasks - Array of tasks to analyze
   * @param userId - Optional user ID to filter tasks for individual analysis
   */
  private calculateCycleTime(tasks: any[], userId?: string): Array<{ date: string; days: number; taskTitle: string }> {
    // Filter tasks by user if userId is provided
    const filteredTasks = userId
      ? tasks.filter(t => t.assignee_id === userId)
      : tasks;

    return filteredTasks
      .filter(t => t.status === 'done' && t.created_at)
      .map(t => {
        const created = new Date(t.created_at).getTime();
        const completed = Date.now(); // Approximation
        const days = Math.round((completed - created) / (1000 * 60 * 60 * 24));
        return {
          date: new Date(t.created_at).toISOString().split('T')[0],
          days,
          taskTitle: t.title,
        };
      })
      .slice(-50); // Last 50 completed tasks
  }

  /**
   * HELPER: Calculate Throughput Trend with Moving Average
   * Tasks completed per week for the last 8 weeks
   * @param tasks - Array of tasks to analyze
   * @param userId - Optional user ID to filter tasks for individual analysis
   */
  private calculateThroughput(tasks: any[], userId?: string): {
    weeks: string[];
    completed: number[];
    movingAverage: number[];
  } {
    // Filter tasks by user if userId is provided
    const filteredTasks = userId
      ? tasks.filter(t => t.assignee_id === userId)
      : tasks;

    const now = new Date();
    const weeks: string[] = [];
    const completed: number[] = [];

    // Generate last 8 weeks
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      weeks.push(`Week ${8 - i}`);

      const weekTasks = filteredTasks.filter(t => {
        if (t.status !== 'done' || !t.created_at) return false;
        const taskDate = new Date(t.created_at);
        return taskDate >= weekStart && taskDate < weekEnd;
      });

      completed.push(weekTasks.length);
    }

    // Calculate 3-week moving average
    const movingAverage = completed.map((_, idx, arr) => {
      if (idx < 2) return arr[idx];
      const sum = arr[idx] + arr[idx - 1] + arr[idx - 2];
      return Math.round(sum / 3);
    });

    return { weeks, completed, movingAverage };
  }

  /**
   * Generate a comprehensive manager report for the Manager Zone
   * Supports three report types:
   * - weekly_organization: Weekly team productivity overview
   * - user_performance: Individual or team performance analysis
   * - bottleneck_prediction: AI-powered risk and blocker analysis
   *
   * Implements caching based on (organization_id, type, period, userId)
   * NOW with chartData for advanced visualizations
   */
  async generateManagerReport(
    type: string,
    organizationId: string,
    userId: string | undefined,
    user: any,
    period: string,
    forceRegenerate: boolean = false,
  ): Promise<any> {
    // Verify user is manager in this organization
    const userOrg = await this.prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: user.id,
          organization_id: organizationId,
        },
      },
    });

    const role = userOrg?.role_in_org;
    if (!userOrg || (role !== 'admin' && role !== 'manager')) {
      throw new NotFoundException('Only managers can generate reports');
    }

    // CACHE LOGIC: Check if a report already exists for these exact parameters
    if (!forceRegenerate) {
      const cachedReport = await this.prisma.ai_reports.findFirst({
        where: {
          organization_id: organizationId,
          type: `manager_${type}`,
        },
        orderBy: { created_at: 'desc' },
      });

      // Validate cache hit by checking metadata
      if (cachedReport && cachedReport.content && cachedReport.metadata) {
        try {
          const metadata = cachedReport.metadata as { period?: string; target_user_id?: string };

          // Cache hit conditions:
          // 1. Period must match
          // 2. If userId is provided, it must match target_user_id in metadata
          // 3. If userId is undefined, target_user_id should also be undefined/null
          const periodMatches = metadata.period === period;
          const userMatches = userId
            ? metadata.target_user_id === userId
            : !metadata.target_user_id;

          if (periodMatches && userMatches) {
            this.logger.log(`Cache HIT for manager report ${type} (org: ${organizationId.substring(0, 8)}, period: ${period})`);
            const parsed = JSON.parse(cachedReport.content);
            return {
              ...parsed,
              chartData: parsed.chartData || null, // ✅ RETURN CACHED CHART DATA
              cached: true,
              timestamp: cachedReport.created_at || new Date(),
            };
          }
        } catch (error) {
          this.logger.warn(`Failed to parse cached manager report metadata:`, error);
        }
      }
    }

    // Cache MISS or force regenerate - Generate new report
    this.logger.log(`Generating manager report ${type} for org ${organizationId.substring(0, 8)}, period: ${period}`);

    // Gather analytics data for the report
    const tasks = await this.prisma.tasks.findMany({
      where: { organization_id: organizationId },
      include: {
        users_tasks_assignee_idTousers: {
          select: { id: true, username: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // ============ PHASE A: CALCULATE CHART DATA (CONDITIONAL BY REPORT TYPE) ============
    this.logger.log(`Calculating chart data for ${type} report...`);

    const chartData: any = {};

    // Calculate Risk Score (used in all report types for "The Pulse")
    const riskScore = this.calculateRiskScore(tasks, organizationId);

    // Calculate DORA metrics with sparklines (used in most reports)
    const doraMetrics = this.calculateDoraMetrics(tasks);

    // Build "The Pulse" KPI Cards with sparklines
    chartData.pulse = {
      velocityStability: {
        value: doraMetrics.velocityStability,
        sparkline: doraMetrics.sparklineData,
      },
      cycleTime: {
        value: doraMetrics.leadTimeAvg,
        sparkline: doraMetrics.cycleTimeSparkline,
      },
      reviewEfficiency: {
        value: Math.round(doraMetrics.reviewEfficiencySparkline.reduce((a, b) => a + b, 0) / Math.max(doraMetrics.reviewEfficiencySparkline.length, 1)),
        sparkline: doraMetrics.reviewEfficiencySparkline,
      },
      riskScore: {
        value: riskScore,
        sparkline: [], // Risk score is a single value, no sparkline
      },
    };

    // Calculate only the charts needed for each report type
    switch (type) {
      case 'weekly_organization':
        // Weekly reports focus on team metrics and workflow
        chartData.cfd = this.generateSmoothCFD(tasks, period);
        chartData.investment = this.calculateInvestmentProfile(tasks);
        chartData.heatmap = await this.analyzeWorkloadHeatmap(organizationId, tasks, period);
        chartData.burndown = this.projectBurndownCone(tasks, period);
        this.logger.log('Weekly organization charts: CFD, Investment, Heatmap, Burndown');
        break;

      case 'user_performance':
        // Performance reports focus on individual metrics
        chartData.radar = await this.calculateRadarMetrics(organizationId, userId);
        chartData.cycleTime = this.calculateCycleTime(tasks, userId);
        chartData.throughput = this.calculateThroughput(tasks, userId);
        chartData.investment = this.calculateInvestmentProfile(tasks, userId);
        this.logger.log('User performance charts: Radar, CycleTime, Throughput, Investment');
        break;

      case 'bottleneck_prediction':
        // Bottleneck reports focus on risk indicators
        chartData.cfd = this.generateSmoothCFD(tasks, period);
        chartData.cycleTime = this.calculateCycleTime(tasks);
        chartData.investment = this.calculateInvestmentProfile(tasks);
        chartData.heatmap = await this.analyzeWorkloadHeatmap(organizationId, tasks, period);
        chartData.burndown = this.projectBurndownCone(tasks, period);
        this.logger.log('Bottleneck prediction charts: CFD, CycleTime, Investment, Heatmap, Burndown');
        break;

      default:
        this.logger.warn(`Unknown report type: ${type}, calculating all charts as fallback`);
        chartData.investment = this.calculateInvestmentProfile(tasks);
        chartData.cfd = this.generateSmoothCFD(tasks, period);
        chartData.radar = await this.calculateRadarMetrics(organizationId);
        chartData.cycleTime = this.calculateCycleTime(tasks);
        chartData.throughput = this.calculateThroughput(tasks);
        chartData.heatmap = await this.analyzeWorkloadHeatmap(organizationId, tasks, period);
        chartData.burndown = this.projectBurndownCone(tasks, period);
    }

    this.logger.log('Chart data calculated successfully');

    const teamMembers = await this.prisma.user_organizations.findMany({
      where: { organization_id: organizationId },
      include: {
        users: {
          select: { id: true, username: true },
        },
      },
    });

    // Calculate statistics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const pendingValidation = tasks.filter(t => t.status === 'pending_validation').length;
    const todoTasks = tasks.filter(t => t.status === 'todo').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const now = new Date();
    const overdueTasks = tasks.filter(t =>
      t.due_date && new Date(t.due_date) < now && t.status !== 'done'
    );

    // Calculate per-user stats
    const userStats = new Map<string, { username: string; completed: number; inProgress: number; total: number }>();
    for (const member of teamMembers) {
      if (member.users) {
        userStats.set(member.users.id, {
          username: member.users.username,
          completed: 0,
          inProgress: 0,
          total: 0,
        });
      }
    }
    for (const task of tasks) {
      if (task.assignee_id && userStats.has(task.assignee_id)) {
        const stats = userStats.get(task.assignee_id)!;
        stats.total++;
        if (task.status === 'done') stats.completed++;
        if (task.status === 'in_progress') stats.inProgress++;
      }
    }

    // Build the prompt based on report type
    let prompt: string;
    const baseContext = `
ORGANIZATION ANALYTICS:
- Total Tasks: ${totalTasks}
- Completed: ${completedTasks} (${completionRate}% completion rate)
- In Progress: ${inProgressTasks}
- To Do: ${todoTasks}
- Pending Validation: ${pendingValidation}
- Overdue Tasks: ${overdueTasks.length}
- Team Size: ${teamMembers.length}

TEAM MEMBERS PERFORMANCE:
${Array.from(userStats.values()).map(u => `- ${u.username}: ${u.completed} completed, ${u.inProgress} in progress, ${u.total} total`).join('\n')}

OVERDUE TASKS:
${overdueTasks.slice(0, 5).map(t => `- "${t.title}" (assigned to: ${t.users_tasks_assignee_idTousers?.username || 'Unassigned'})`).join('\n') || 'None'}

RECENT TASKS (Last 10):
${tasks.slice(0, 10).map(t => `- [${t.status}] "${t.title}" - ${t.users_tasks_assignee_idTousers?.username || 'Unassigned'}`).join('\n')}
`;

    switch (type) {
      case 'weekly_organization':
        prompt = `You are a senior project manager writing a weekly organization report.

${baseContext}

Write a comprehensive weekly report that includes:
1. Executive Summary (2-3 sentences highlighting key achievements and concerns)
2. Productivity Analysis (team velocity, completion trends)
3. Current Workload Distribution (who's doing what, balance assessment)
4. Upcoming Priorities (what should the team focus on next week)
5. Recommendations (actionable suggestions for improvement)

CRITICAL OUTPUT INSTRUCTIONS:
- Return ONLY a raw JSON object, nothing else
- Do NOT wrap the response in markdown code blocks
- The response must start with { and end with }

Required JSON structure:
{
  "summary": "Executive summary here",
  "sections": [
    {"title": "Productivity Analysis", "content": "Detailed analysis..."},
    {"title": "Workload Distribution", "content": "Assessment..."},
    {"title": "Upcoming Priorities", "content": "Focus areas..."},
    {"title": "Recommendations", "content": "Suggestions..."}
  ]
}`;
        break;

      case 'user_performance':
        const targetUser = userId ? userStats.get(userId) : null;
        const performanceContext = targetUser
          ? `\nFOCUS ON USER: ${targetUser.username}\n- Completed: ${targetUser.completed}\n- In Progress: ${targetUser.inProgress}\n- Total Assigned: ${targetUser.total}`
          : '\nANALYZE ALL TEAM MEMBERS';

        prompt = `You are a senior HR analyst writing a performance review.

${baseContext}
${performanceContext}

Write a comprehensive performance analysis that includes:
1. Executive Summary (key findings about ${targetUser ? targetUser.username : 'the team'})
2. Productivity Metrics (task completion rates, efficiency)
3. Strengths Identified (what's working well)
4. Areas for Improvement (constructive feedback)
5. Development Recommendations (actionable next steps)

CRITICAL OUTPUT INSTRUCTIONS:
- Return ONLY a raw JSON object, nothing else
- Do NOT wrap the response in markdown code blocks
- The response must start with { and end with }

Required JSON structure:
{
  "summary": "Executive summary here",
  "sections": [
    {"title": "Productivity Metrics", "content": "Detailed metrics..."},
    {"title": "Strengths Identified", "content": "Positive observations..."},
    {"title": "Areas for Improvement", "content": "Constructive feedback..."},
    {"title": "Development Recommendations", "content": "Next steps..."}
  ]
}`;
        break;

      case 'bottleneck_prediction':
        prompt = `You are a senior project risk analyst identifying potential bottlenecks and risks.

${baseContext}

Analyze the data and predict potential bottlenecks:
1. Executive Summary (key risks and concerns)
2. Current Bottlenecks (tasks or areas blocking progress)
3. Resource Constraints (overloaded team members, capacity issues)
4. Risk Assessment (potential future problems)
5. Mitigation Strategies (how to address identified risks)

CRITICAL OUTPUT INSTRUCTIONS:
- Return ONLY a raw JSON object, nothing else
- Do NOT wrap the response in markdown code blocks
- The response must start with { and end with }

Required JSON structure:
{
  "summary": "Executive summary of risks here",
  "sections": [
    {"title": "Current Bottlenecks", "content": "Identified blockers..."},
    {"title": "Resource Constraints", "content": "Capacity issues..."},
    {"title": "Risk Assessment", "content": "Future concerns..."},
    {"title": "Mitigation Strategies", "content": "Recommendations..."}
  ]
}`;
        break;

      default:
        throw new NotFoundException('Invalid report type');
    }

    // Call Gemini
    const aiResponse = await this.callGemini(prompt);

    // Parse the response using failsafe method
    const result = this.safeParseTaskReport(aiResponse);

    // Save to ai_reports table for history with organization_id, metadata, and chartData
    try {
      await this.prisma.ai_reports.create({
        data: {
          organization_id: organizationId,
          type: `manager_${type}`,
          content: JSON.stringify({
            summary: result.summary,
            sections: result.sections,
            report_type: type,
            chartData, // ✅ PERSIST CHART DATA
          }),
          metadata: {
            period,
            target_user_id: userId || null,
          },
        },
      });
      this.logger.log(`Saved manager report with chart data: ${type} for org ${organizationId.substring(0, 8)}, period: ${period}`);
    } catch (cacheError) {
      this.logger.warn(`Failed to save manager report:`, cacheError);
    }

    return {
      id: crypto.randomUUID(),
      type,
      summary: result.summary,
      sections: result.sections,
      chartData, // ✅ RETURN CHART DATA TO FRONTEND
      created_at: new Date().toISOString(),
      cached: false,
      timestamp: new Date(),
    };
  }
}
