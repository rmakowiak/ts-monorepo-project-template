import express, { Express, Request, Response } from "express";

const app: Express = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Hello from monorepo template!" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
