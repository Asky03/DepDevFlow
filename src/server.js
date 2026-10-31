const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10kb" }));

app.get("/", (req, res) => {
  res.json({
    project: "DepDevFlow",
    message: "Adaptive DevSecOps pipeline is operational"
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

app.get("/api/greet", (req, res) => {
  const name = String(req.query.name || "Developer").slice(0, 50);

  res.json({
    message: `Hello, ${name}!`,
    project: "DepDevFlow"
  });
});

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DepDevFlow running on port ${PORT}`);
  });
}

module.exports = app;
