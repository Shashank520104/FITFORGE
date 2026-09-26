
import { Request, Response, NextFunction } from "express";

const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);

  if (err.name === "ValidationError") {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: Object.values(err.errors).map(
        (error: any) => error.message
      )
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
};

export default errorMiddleware;

