import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";
const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
  res.status(401).json({
    success: false,
    message: "Authentication required"
  });
  return;
}

const token = authHeader.split(" ")[1];

try {
  const decoded = jwt.verify(
  token,
  process.env.JWT_SECRET as string
) as JwtPayload & {
  userId: string;
};
req.user = decoded;
next();
} 

catch (error) {
  res.status(401).json({
    success: false,
    message: "Invalid or expired token"
  });
  return;
}
};
export default authMiddleware;