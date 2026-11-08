import { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../errors/httpError.js";
import { PersonalizationService } from "../services/personalizationService.js";

const profileSchema = z
  .object({
    heightCm: z.number().min(100).max(250),
    weightKg: z.number().min(30).max(350),
    dietPreference: z.enum(["vegetarian", "non_vegetarian", "vegan"]),
    experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
    exerciseCleared: z.boolean().default(false),
  })
  .strict();

const uuidSchema = z.uuid();

const allowedMediaTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
const mediaTypes = new Set<string>(allowedMediaTypes);

function sniffMediaType(
  file: Buffer,
): (typeof allowedMediaTypes)[number] | null {
  if (file.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (
    file.length >= 3 &&
    file[0] === 0xff &&
    file[1] === 0xd8 &&
    file[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    file.length >= 8 &&
    file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return "image/png";
  }
  return null;
}

export class PersonalizationController {
  constructor(private readonly service: PersonalizationService) {}

  getProfile = async (_req: Request, res: Response): Promise<void> => {
    const ownerId = this.getOwnerId(res);
    const profile = await this.service.getProfile(ownerId);
    res.status(200).json({ success: true, data: profile });
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const ownerId = this.getOwnerId(res);
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "INVALID_WELLNESS_PROFILE",
        z.prettifyError(parsed.error),
      );
    }

    const updated = await this.service.updateProfile(ownerId, parsed.data);
    res.status(200).json({ success: true, data: updated });
  };

  listReports = async (_req: Request, res: Response): Promise<void> => {
    const ownerId = this.getOwnerId(res);
    const reports = await this.service.listReports(ownerId);
    res.setHeader("cache-control", "no-store");
    res.status(200).json({ success: true, data: reports });
  };

  uploadReport = async (req: Request, res: Response): Promise<void> => {
    const ownerId = this.getOwnerId(res);
    const contentType = req.header("content-type")?.split(";")[0].trim();
    if (!contentType || !mediaTypes.has(contentType)) {
      throw new HttpError(
        415,
        "UNSUPPORTED_REPORT_TYPE",
        "Upload a PDF, JPEG, or PNG report.",
      );
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new HttpError(
        400,
        "EMPTY_REPORT",
        "The uploaded report is empty or could not be read.",
      );
    }
    if (req.body.length > 8 * 1024 * 1024) {
      throw new HttpError(
        413,
        "REPORT_TOO_LARGE",
        "Reports must be 8 MB or smaller.",
      );
    }
    if (sniffMediaType(req.body) !== contentType) {
      throw new HttpError(
        400,
        "REPORT_TYPE_MISMATCH",
        "The file contents do not match the selected report type.",
      );
    }

    const result = await this.service.uploadReport(
      ownerId,
      req.body,
      contentType,
      req.header("x-file-name"),
    );

    res.status(201).json({
      success: true,
      data: {
        ...result,
        createdAt: new Date().toISOString(),
        note: "Adding a report revokes exercise clearance until confirmed with a clinician.",
      },
    });
  };

  summarizeReport = async (req: Request, res: Response): Promise<void> => {
    const ownerId = this.getOwnerId(res);
    const reportId = uuidSchema.safeParse(req.params.reportId);
    if (!reportId.success) {
      throw new HttpError(400, "INVALID_REPORT_ID", "Report ID is invalid.");
    }

    const summary = await this.service.summarizeReport(ownerId, reportId.data);
    res.setHeader("cache-control", "no-store");
    res.status(200).json({ success: true, data: summary });
  };

  deleteReport = async (req: Request, res: Response): Promise<void> => {
    const ownerId = this.getOwnerId(res);
    const reportId = uuidSchema.safeParse(req.params.reportId);
    if (!reportId.success) {
      throw new HttpError(400, "INVALID_REPORT_ID", "Report ID is invalid.");
    }

    await this.service.deleteReport(ownerId, reportId.data);
    res.status(200).json({
      success: true,
      data: {
        deleted: true,
        note: "Deleting a report does not restore exercise clearance. Confirm with a clinician before enabling workouts.",
      },
    });
  };

  getPlan = async (_req: Request, res: Response): Promise<void> => {
    const ownerId = this.getOwnerId(res);
    const plan = await this.service.getPlan(ownerId);
    res.status(200).json({ success: true, data: plan });
  };

  generatePlan = async (_req: Request, res: Response): Promise<void> => {
    const ownerId = this.getOwnerId(res);
    const plan = await this.service.generatePlan(ownerId);
    res.setHeader("cache-control", "no-store");
    res.status(200).json({ success: true, data: plan });
  };

  private getOwnerId(res: Response): string {
    const ownerId: unknown = res.locals.ownerId;
    if (typeof ownerId !== "string" || !uuidSchema.safeParse(ownerId).success) {
      throw new HttpError(
        401,
        "INVALID_ACCESS_TOKEN",
        "The access token does not contain a valid account ID",
      );
    }
    return ownerId;
  }
}
