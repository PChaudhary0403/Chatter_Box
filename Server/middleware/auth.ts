import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const auth = (req: any, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const JWT_SECRET="Pankaj@0403"
    if (!header) {
        return res.status(401).json({ message: "No token" });
    }

    const token = header.split(" ")[1];
    console.log("Token Mil gya",token)
    try {
        const decoded = jwt.verify(token,JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(403).json({ message: "Invalid token" });
    }
};

export default auth;