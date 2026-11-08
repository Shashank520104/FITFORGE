import { randomUUID } from "node:crypto";
import { PersonalizationConfig } from "../config.js";
import { decryptReport, encryptReport } from "../crypto.js";
import { HttpError } from "../errors/httpError.js";
import { extractReportText } from "../extractReportText.js";
import { PersonalizationRepository } from "../repositories/personalizationRepository.js";
import {
  HealthReportRow,
  WellnessPlanRecord,
  WellnessProfileRecord,
} from "../types/index.js";
import { AiService } from "./aiService.js";

export class PersonalizationService {
  constructor(
    private readonly repository: PersonalizationRepository,
    private readonly aiService: AiService,
    private readonly config: PersonalizationConfig,
    private readonly textExtractor: typeof extractReportText = extractReportText,
  ) {}

  async getProfile(ownerId: string): Promise<WellnessProfileRecord | null> {
    return this.repository.getProfile(ownerId);
  }

  async updateProfile(
    ownerId: string,
    profile: {
      heightCm: number;
      weightKg: number;
      dietPreference: string;
      experienceLevel: string;
      exerciseCleared: boolean;
    },
  ): Promise<WellnessProfileRecord> {
    return this.repository.upsertProfile(ownerId, profile);
  }

  async listReports(ownerId: string): Promise<HealthReportRow[]> {
    return this.repository.listReports(ownerId);
  }

  async uploadReport(
    ownerId: string,
    fileBuffer: Buffer,
    contentType: string,
    rawFilename: string | undefined,
  ): Promise<{ id: string; filename: string; mediaType: string; fileSize: number }> {
    const filename = this.sanitizeFilename(rawFilename);
    const encrypted = encryptReport(fileBuffer, this.config.REPORT_ENCRYPTION_KEY);
    const id = randomUUID();

    await this.repository.saveEncryptedReport(
      id,
      ownerId,
      filename,
      contentType,
      fileBuffer.length,
      encrypted.ciphertext,
      encrypted.initializationVector,
      encrypted.authenticationTag,
    );

    return {
      id,
      filename,
      mediaType: contentType,
      fileSize: fileBuffer.length,
    };
  }

  async summarizeReport(
    ownerId: string,
    reportId: string,
  ): Promise<{ reportId: string; summary: string; note: string; provider: string }> {
    const report = await this.repository.getEncryptedReport(reportId, ownerId);
    if (!report) {
      throw new HttpError(404, "REPORT_NOT_FOUND", "Report was not found.");
    }

    const decryptedBytes = decryptReport(
      {
        ciphertext: report.encrypted_content,
        initializationVector: report.initialization_vector,
        authenticationTag: report.authentication_tag,
      },
      this.config.REPORT_ENCRYPTION_KEY,
    );

    let extractedText = "";
    try {
      extractedText = (
        await this.textExtractor(decryptedBytes, report.media_type)
      ).trim();
    } catch (error) {
      console.error(
        "Health report text extraction failed",
        error instanceof Error ? error.name : "UnknownError",
      );
      throw new HttpError(
        422,
        "REPORT_TEXT_UNAVAILABLE",
        "We could not read text from this report. Check that it is not damaged and contains selectable text or clear printed text.",
      );
    }

    if (extractedText.length < 20) {
      throw new HttpError(
        422,
        "REPORT_TEXT_UNAVAILABLE",
        "We could not find enough readable text in this report to summarize it.",
      );
    }

    const summary = await this.aiService.summarizeReportText(extractedText);
    return {
      reportId: report.id,
      summary,
      note: "AI summaries can misread reports. Verify every detail against the original and speak with your clinician. This summary does not decide which exercise or diet is safe.",
      provider: "Ollama (local)",
    };
  }

  async deleteReport(ownerId: string, reportId: string): Promise<void> {
    const deleted = await this.repository.deleteReport(reportId, ownerId);
    if (!deleted) {
      throw new HttpError(404, "REPORT_NOT_FOUND", "Report was not found.");
    }
  }

  async getPlan(ownerId: string): Promise<WellnessPlanRecord | null> {
    const record = await this.repository.getPlan(ownerId);
    if (!record) {
      return null;
    }

    const profile = await this.repository.getProfile(ownerId);
    const exerciseCleared = Boolean(profile?.exerciseCleared);

    return {
      ...record.plan,
      workoutDays: exerciseCleared ? (record.plan.workoutDays ?? null) : null,
      generatedAt: record.generatedAt,
      exerciseCleared,
      workoutNotice: exerciseCleared
        ? null
        : "Workout suggestions are hidden until you confirm a clinician has cleared exercise. AI cannot decide whether exercise is safe for you.",
    };
  }

  async generatePlan(ownerId: string): Promise<WellnessPlanRecord> {
    const profile = await this.repository.getProfile(ownerId);
    if (!profile) {
      throw new HttpError(
        409,
        "WELLNESS_PROFILE_REQUIRED",
        "Save your height, weight, and diet preference before generating a plan.",
      );
    }

    const plan = await this.aiService.generateWellnessPlan(profile);
    await this.repository.savePlan(ownerId, plan);
    return plan;
  }

  private sanitizeFilename(value: string | undefined): string {
    if (!value) {
      throw new HttpError(400, "INVALID_REPORT_NAME", "A report filename is required");
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(value);
    } catch {
      throw new HttpError(400, "INVALID_REPORT_NAME", "The report filename is invalid");
    }
    const filename = decoded
      .replace(/[\\/]/g, "_")
      .replace(/[^\p{L}\p{N}._ -]/gu, "")
      .trim()
      .slice(0, 120);
    if (!filename || filename === "." || filename === "..") {
      throw new HttpError(400, "INVALID_REPORT_NAME", "The report filename is invalid");
    }
    return filename;
  }
}
