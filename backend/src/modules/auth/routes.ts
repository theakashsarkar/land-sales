import { Router } from "express";
import { validateBody } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import * as authService from "./service.js";
import { loginSchema, refreshSchema } from "./schemas.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const meta = { ip: req.ip, userAgent: req.get("user-agent") };
    const result = await authService.login(req.body, meta);
    authService.setRefreshCookie(res, result.refreshToken);
    res.json({ user: result.user, accessToken: result.accessToken });
  }),
);

authRouter.post(
  "/refresh",
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const raw = (req.cookies?.[authService.REFRESH_COOKIE] as string | undefined) ?? req.body?.refreshToken;
    const result = await authService.refresh(raw);
    authService.setRefreshCookie(res, result.refreshToken);
    res.json({ user: result.user, accessToken: result.accessToken });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const raw =
      (req.cookies?.[authService.REFRESH_COOKIE] as string | undefined) ?? req.body?.refreshToken;
    await authService.logout(raw, { ip: req.ip, userAgent: req.get("user-agent") });
    authService.clearRefreshCookie(res);
    res.json({ ok: true });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await authService.getMe(req.user!.id));
  }),
);
