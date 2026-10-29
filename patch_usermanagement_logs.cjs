const fs = require('fs');

let code = fs.readFileSync('src/pages/UserManagement.tsx', 'utf8');

// Add import
code = code.replace(
  "import { useBrandingStore } from '../store/useBrandingStore';",
  "import { useBrandingStore } from '../store/useBrandingStore';\nimport { useActivityLogStore } from '../store/useActivityLogStore';"
);

// Add hook
code = code.replace(
  "const settings = useSettingsStore();",
  "const settings = useSettingsStore();\n  const logActivity = useActivityLogStore(s => s.logActivity);"
);

// In handleSubmit
// Update user block
// We need to compare old vs new values if possible, but we don't have the old user immediately in the edit state...
// Ah, we can find it in the `users` array!
code = code.replace(
  /await updateDoc\(docRef, \{ role: formData\.role, permissions: formData\.permissions \}\);/,
  `await updateDoc(docRef, { role: formData.role, permissions: formData.permissions });
        const oldUser = users.find(u => u.uid === formData.uid);
        await logActivity({
          action: 'UPDATE',
          entityType: 'USER',
          entityId: formData.uid,
          details: \`Updated user \${formData.email} role/permissions\`,
          changes: oldUser ? [
            { field: 'role', oldValue: oldUser.role, newValue: formData.role },
            { field: 'permissions', oldValue: oldUser.permissions, newValue: formData.permissions }
          ] : []
        });`
);

// Create user block
code = code.replace(
  /setIsModalOpen\(false\);\s*\}\s*\} catch \(err: any\)/,
  `
        await logActivity({
          action: 'CREATE',
          entityType: 'USER',
          entityId: data.uid || 'unknown',
          details: \`Created new user \${formData.email} (\${formData.role})\`
        });
        setIsModalOpen(false);
      }
    } catch (err: any)`
);

// handleDelete block
code = code.replace(
  /if \(\!data\.success\) \{\s*throw new Error\(data\.error \|\| 'Failed to delete user'\);\s*\}/,
  `if (!data.success) {
          throw new Error(data.error || 'Failed to delete user');
        }
        const deletedUser = users.find(u => u.uid === uid);
        await logActivity({
          action: 'DELETE',
          entityType: 'USER',
          entityId: uid,
          details: \`Deleted user \${deletedUser?.email || uid}\`
        });`
);

fs.writeFileSync('src/pages/UserManagement.tsx', code);
