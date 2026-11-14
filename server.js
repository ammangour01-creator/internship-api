const app = require("./src/app");

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Internship API running at http://localhost:${PORT}`);
});
