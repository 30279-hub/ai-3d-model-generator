import { app } from "./app.js";
import { config, ensureStorageDirs } from "./config.js";

await ensureStorageDirs();

app.listen(config.port, () => {
  console.log(`AI 3D generator API listening on http://localhost:${config.port}`);
});
