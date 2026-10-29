const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const pwdApi = `
  // Update User Password
  app.put("/api/users/:uid/password", async (req, res) => {
    try {
      const { uid } = req.params;
      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }
      await adminAuth.updateUser(uid, { password });
      res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete User`;

code = code.replace(/\/\/ Delete User/, pwdApi);
fs.writeFileSync('server.ts', code);
