import { Router } from 'express';
import { usersController } from '../controllers/users.controller';
import { requireAdmin, requireAuth } from '../middlewares/auth';
import { validateSchema } from '../middlewares/validateSchema';
import loginSchema from '../schemas/login.schema.json';
import registerSchema from '../schemas/register.schema.json';
import addUserSchema from '../schemas/add-user.schema.json';
import adminPermissionsPatchSchema from '../schemas/admin-permissions-patch.schema.json';
import profileSelfPatchSchema from '../schemas/profile-self-patch.schema.json';

const router = Router();

router.post('/register', validateSchema(registerSchema), (req, res) =>
  usersController.register(req, res),
);
router.post('/login', validateSchema(loginSchema), (req, res) => usersController.login(req, res));

router.patch('/me', requireAuth, validateSchema(profileSelfPatchSchema), (req, res) =>
  usersController.patchMe(req, res),
);
router.delete('/me', requireAuth, (req, res) => usersController.deleteMe(req, res));
router.post('/add', requireAuth, requireAdmin, validateSchema(addUserSchema), (req, res) =>
  usersController.addUser(req, res),
);

router.get('/admin/users', requireAuth, requireAdmin, (req, res) =>
  usersController.listAdminUsers(req, res),
);
router.patch(
  '/admin/users/:userId/permissions',
  requireAuth,
  requireAdmin,
  validateSchema(adminPermissionsPatchSchema),
  (req, res) => usersController.patchUserPermissions(req, res),
);
router.delete('/admin/users/:userId', requireAuth, requireAdmin, (req, res) =>
  usersController.deleteAdminUser(req, res),
);

export default router;
