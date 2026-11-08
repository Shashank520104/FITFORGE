import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AuthConfig } from "../config.js";
import { HttpError } from "../errors/httpError.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { AuthResponseData, AuthUser } from "../types/index.js";
import { issueAccessToken, issueRefreshToken } from "../utils/token.js";

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly config: AuthConfig,
  ) {}

  async register(
    email: string,
    plainPassword: string,
  ): Promise<{ data: AuthResponseData; refreshToken: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(plainPassword, 12);
    const refreshToken = issueRefreshToken();

    try {
      const user = await this.repository.createUserWithSession(
        normalizedEmail,
        passwordHash,
        refreshToken,
        this.config.REFRESH_TOKEN_TTL_DAYS,
      );

      return {
        data: {
          user,
          accessToken: issueAccessToken(user, this.config),
          tokenType: "Bearer",
          expiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS,
        },
        refreshToken,
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new HttpError(
          409,
          "EMAIL_ALREADY_REGISTERED",
          "Email is already registered",
        );
      }
      throw error;
    }
  }

  async login(
    email: string,
    plainPassword: string,
  ): Promise<{ data: AuthResponseData; refreshToken: string }> {
    const account = await this.repository.findUserByEmail(email);
    if (
      !account ||
      !(await bcrypt.compare(plainPassword, account.password_hash))
    ) {
      throw new HttpError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect",
      );
    }

    const user: AuthUser = { id: account.id, email: account.email };
    const refreshToken = issueRefreshToken();
    await this.repository.createRefreshSession(
      user.id,
      refreshToken,
      this.config.REFRESH_TOKEN_TTL_DAYS,
    );

    return {
      data: {
        user,
        accessToken: issueAccessToken(user, this.config),
        tokenType: "Bearer",
        expiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS,
      },
      refreshToken,
    };
  }

  async refresh(
    presentedToken: string | undefined,
  ): Promise<{ data: AuthResponseData; nextRefreshToken: string } | null> {
    if (!presentedToken) {
      return null;
    }

    const nextRefreshToken = issueRefreshToken();
    const user = await this.repository.rotateRefreshSession(
      presentedToken,
      nextRefreshToken,
      this.config.REFRESH_TOKEN_TTL_DAYS,
    );

    if (!user) {
      throw new HttpError(
        401,
        "INVALID_REFRESH_TOKEN",
        "Refresh session is missing or expired",
      );
    }

    return {
      data: {
        user,
        accessToken: issueAccessToken(user, this.config),
        tokenType: "Bearer",
        expiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS,
      },
      nextRefreshToken,
    };
  }

  async logout(presentedToken: string | undefined): Promise<void> {
    if (presentedToken) {
      await this.repository.revokeSession(presentedToken);
    }
  }

  async getProfile(authHeader: string | undefined): Promise<AuthUser> {
    const match = authHeader?.match(/^Bearer ([^\s]+)$/);
    if (!match) {
      throw new HttpError(
        401,
        "AUTHENTICATION_REQUIRED",
        "A bearer access token is required",
      );
    }

    let subject: string;
    try {
      const payload = jwt.verify(match[1], this.config.JWT_SECRET, {
        algorithms: ["HS256"],
      });
      if (typeof payload === "string" || typeof payload.sub !== "string") {
        throw new Error("Invalid token subject");
      }
      subject = payload.sub;
    } catch {
      throw new HttpError(
        401,
        "INVALID_ACCESS_TOKEN",
        "Access token is invalid or expired",
      );
    }

    const user = await this.repository.findUserById(subject);
    if (!user) {
      throw new HttpError(
        401,
        "INVALID_ACCESS_TOKEN",
        "Access token is invalid or expired",
      );
    }

    return user;
  }
}
