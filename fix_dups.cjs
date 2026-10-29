const fs = require('fs');

let code = fs.readFileSync('src/pages/UserManagement.tsx', 'utf8');

const oldUserDup = `        const oldUser = users.find(u => u.uid === formData.uid);
        await logActivity({
          action: 'UPDATE',
          entityType: 'USER',
          entityId: formData.uid,
          details: \`Updated user \${formData.email} role/permissions\`,
          changes: oldUser ? [
            { field: 'role', oldValue: oldUser.role, newValue: formData.role },
            { field: 'permissions', oldValue: oldUser.permissions, newValue: formData.permissions }
          ] : []
        });
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
        });`;

const deletedUserDup = `        const deletedUser = users.find(u => u.uid === uid);
        await logActivity({
          action: 'DELETE',
          entityType: 'USER',
          entityId: uid,
          details: \`Deleted user \${deletedUser?.email || uid}\`
        });
        const deletedUser = users.find(u => u.uid === uid);
        await logActivity({
          action: 'DELETE',
          entityType: 'USER',
          entityId: uid,
          details: \`Deleted user \${deletedUser?.email || uid}\`
        });`;

code = code.replace(oldUserDup, `        const oldUser = users.find(u => u.uid === formData.uid);
        await logActivity({
          action: 'UPDATE',
          entityType: 'USER',
          entityId: formData.uid,
          details: \`Updated user \${formData.email} role/permissions\`,
          changes: oldUser ? [
            { field: 'role', oldValue: oldUser.role, newValue: formData.role },
            { field: 'permissions', oldValue: oldUser.permissions, newValue: formData.permissions }
          ] : []
        });`);

code = code.replace(deletedUserDup, `        const deletedUser = users.find(u => u.uid === uid);
        await logActivity({
          action: 'DELETE',
          entityType: 'USER',
          entityId: uid,
          details: \`Deleted user \${deletedUser?.email || uid}\`
        });`);

fs.writeFileSync('src/pages/UserManagement.tsx', code);
