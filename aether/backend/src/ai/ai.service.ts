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
            temperature: 0.3,
            maxOutputTokens: 2048,
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
   */
  async explainCommitInTaskContext(
    sha: string,
    taskId: string,
    user: any,
  ): Promise<CommitInTaskContextExplanation> {
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

    // Get the diff
    const match = commit.repos.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new NotFoundException('Invalid repository URL');
    }

    const [, owner, repoName] = match;
    const diff = await this.githubService.getDiff(
      owner,
      repoName.replace('.git', ''),
      sha,
      user.github_access_token,
    );

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

    const aiResponse = await this.callGemini(prompt);

    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sha,
          taskId: task.id,
          taskTitle: task.title,
          readableId: task.readable_id,
          explanation: parsed.explanation || 'Commit analizado',
          howItFulfillsTask: parsed.howItFulfillsTask || 'Ver detalles del commit',
          remainingWork: parsed.remainingWork || [],
          technicalDetails: parsed.technicalDetails || 'Sin detalles técnicos',
        };
      }
    } catch (error) {
      this.logger.warn('Could not parse contextual commit explanation:', error);
    }

    // Fallback
    return {
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
  /**
   * Analyze code quality and vulnerabilities for a specific commit
   * Implements caching strategy
   */
  async analyzeCode(sha: string, user: any, onlyCached: boolean = false): Promise<any> {
    // Check cache
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

    // Cache Miss - Generate
    this.logger.log(`Cache MISS for code analysis ${sha.substring(0, 7)}, generating...`);

    // Fetch commit and diff (reuse existing logic if possible, or duplicate for now to be safe)
    const commit = await this.prisma.commits.findUnique({ where: { sha }, include: { repos: true } });
    if (!commit || !commit.repos) throw new NotFoundException('Commit not found');

    const match = commit.repos.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new NotFoundException('Invalid repo URL');
    const [, owner, repoName] = match;

    const diff = await this.githubService.getDiff(owner, repoName.replace('.git', ''), sha, user.github_access_token);

    const prompt = `Analyze this code for security vulnerabilities and code quality.

COMMIT: ${sha.substring(0, 7)}
Message: ${diff.message}
Changes:
${diff.files.slice(0, 5).map(f => `\n--- ${f.filename} ---\n${f.patch?.substring(0, 1000) || 'No patch'}`).join('\n')}

Respond in this exact JSON format:
{
  "summary": "Brief summary of security and quality findings",
  "score": "Letter grade (A, B, C, D, F)",
  "issues": [
    { "severity": "high/medium/low", "title": "Issue title", "file": "filename", "line": 123 }
  ]
}`;

    const aiResponse = await this.callGemini(prompt);
    let result;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (e) {
      result = {
        summary: aiResponse.substring(0, 200),
        score: 'N/A',
        issues: []
      };
    }

    // Cache result
    await this.prisma.ai_reports.create({
      data: {
        commit_sha: sha,
        type: 'code_analysis',
        content: JSON.stringify(result),
      },
    });

    return { ...result, cached: false, timestamp: new Date() };
  }

  /**
   * Generate a comprehensive task report based on task status, comments, and commits
   * NOW includes the specific commit's diff to make the report contextual to the selected commit
   */
  async generateTaskReport(taskId: string, commitSha: string | null, user: any, onlyCached: boolean = false): Promise<any> {
    if (!commitSha) {
      throw new Error('Commit SHA is required for indexing the report');
    }

    // Check cache using both task_id and commit_sha for proper scoping
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

    const prompt = `Generate a comprehensive progress report for this task, focusing on the snapshot at commit ${commitSha.substring(0, 7)}.

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

INSTRUCTIONS:
Analyze the progress at this commit snapshot. Consider:
1. What work was completed in this commit
2. How it relates to the task requirements
3. Code quality and implementation approach
4. What might remain to be done

Respond in this exact JSON format:
{
  "summary": "Executive summary of progress at this commit (2-3 sentences)",
  "sections": [
    { "title": "Changes in This Commit", "content": "Detailed explanation of what was implemented" },
    { "title": "Task Progress Assessment", "content": "How close is the task to completion based on this snapshot" },
    { "title": "Technical Observations", "content": "Code quality, patterns used, and technical notes" }
  ]
}`;

    const aiResponse = await this.callGemini(prompt);
    let result;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      else throw new Error('No JSON');
    } catch {
      result = {
        summary: 'Report generation failed - could not parse AI response',
        sections: [
          { title: 'Error', content: 'Failed to generate report. Please try again.' }
        ]
      };
    }

    // Store report with both task_id and commit_sha for proper scoping
    await this.prisma.ai_reports.create({
      data: {
        task_id: taskId,
        commit_sha: commitSha,
        type: 'task_report',
        content: JSON.stringify(result)
      }
    });

    this.logger.log(`Cached task report for ${taskId.substring(0, 8)}/${commitSha.substring(0, 7)}`);
    return { ...result, cached: false, timestamp: new Date() };
  }
}
