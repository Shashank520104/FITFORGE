import { Request, Response } from "express";
import { z } from "zod";
import { AuthConfig } from "../config.js";
import { HttpError } from "../errors/httpError.js";
import { AuthService } from "../services/authService.js";
import { readRefreshCookie, setRefreshCookie } from "../utils/token.js";

const registerSchema = z
  .object({
    email: z.email().max(254),
    password: z
      .string()
      .min(12)
      .max(72)
      .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.email().max(254),
    password: z
      .string()
      .min(1)
      .max(72)
      .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
  })
  .strict();

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AuthConfig,
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const validated = registerSchema.safeParse(req.body);
    if (!validated.success) {
      throw new HttpError(
        400,
        "INVALID_REQUEST",
        z.prettifyError(validated.error),
      );
    }

    const { data, refreshToken } = await this.authService.register(
      validated.data.email,
      validated.data.password,
    );

    setRefreshCookie(res, refreshToken, this.config);
    res.status(201).json({ success: true, data });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const validated = loginSchema.safeParse(req.body);
    if (!validated.success) {
      throw new HttpError(
        400,
        "INVALID_REQUEST",
        z.prettifyError(validated.error),
      );
    }

    const { data, refreshToken } = await this.authService.login(
      validated.data.email,
      validated.data.password,
    );

    setRefreshCookie(res, refreshToken, this.config);
    res.status(200).json({ success: true, data });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const presentedToken = readRefreshCookie(req.headers.cookie);
    const result = await this.authService.refresh(presentedToken);

    if (!result) {
      setRefreshCookie(res, undefined, this.config);
      res.status(204).end();
      return;
    }

    setRefreshCookie(res, result.nextRefreshToken, this.config);
    res.status(200).json({ success: true, data: result.data });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const presentedToken = readRefreshCookie(req.headers.cookie);
    await this.authService.logout(presentedToken);
    setRefreshCookie(res, undefined, this.config);
    res.status(204).end();
  };

  getMe = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authService.getProfile(req.header("authorization"));
    res.status(200).json({ success: true, data: user });
  };
}
