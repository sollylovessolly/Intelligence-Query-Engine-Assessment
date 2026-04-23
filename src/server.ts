import app from "./app";
import { seed } from "./seed";

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await seed(); // 🔥 seed every time (safe because of ON CONFLICT)
    console.log("Seed done ✅");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} 🚀`);
    });
  } catch (err) {
    console.error("Startup failed ❌", err);
  }
}

start();