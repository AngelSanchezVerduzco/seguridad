import { Router } from 'express';
import { groupsController } from '../controllers/groups.controller';
import { requireAuth } from '../middlewares/auth';
import { validateSchema } from '../middlewares/validateSchema';
import createSchema from '../schemas/group-create.schema.json';
import patchSchema from '../schemas/group-patch.schema.json';
import memberAddSchema from '../schemas/member-add.schema.json';
import memberRemoveSchema from '../schemas/member-remove.schema.json';

const router = Router();

router.get('/health', (req, res) => groupsController.health(req, res));
router.get('/', requireAuth, (req, res) => groupsController.list(req, res));
router.post('/', requireAuth, validateSchema(createSchema), (req, res) => groupsController.create(req, res));
router.get('/:id', requireAuth, (req, res) => groupsController.getById(req, res));
router.patch('/:id', requireAuth, validateSchema(patchSchema), (req, res) =>
  groupsController.patch(req, res),
);
router.delete('/:id', requireAuth, (req, res) => groupsController.remove(req, res));
router.post('/:id/members', requireAuth, validateSchema(memberAddSchema), (req, res) =>
  groupsController.addMember(req, res),
);
router.delete('/:id/members', requireAuth, validateSchema(memberRemoveSchema), (req, res) =>
  groupsController.removeMember(req, res),
);

export default router;
