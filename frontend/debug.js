import dotenv from "dotenv";
dotenv.config({ path: ".env" });
(async () => {
  try {
    const res = await fetch("https://ngvnkvzpaynlwvajlxis.supabase.co/functions/v1/api/users/7acf99ac-b0ac-457e-900d-eaff6a3ca084/detail", {
      headers: { "Authorization": "Bearer " + process.env.VITE_SUPABASE_ANON_KEY }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
})();
