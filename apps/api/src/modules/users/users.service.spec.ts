import { type PrismaService } from '../../prisma/prisma.service';

import { UsersService } from './users.service';

const userId = '11111111-1111-1111-1111-111111111111';

describe('UsersService', () => {
  it('updates the caller and returns the AuthUserDto shape, without the password hash', async () => {
    const update = jest.fn().mockResolvedValue({ id: userId, email: 'person@example.com', name: 'person', locale: 'en-US' });
    const prisma = { user: { update } } as unknown as PrismaService;
    const service = new UsersService(prisma);

    const result = await service.updateCurrentUser(userId, { locale: 'en-US' });

    expect(update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { locale: 'en-US' },
      select: { id: true, email: true, name: true, locale: true },
    });
    expect(result).toEqual({ id: userId, email: 'person@example.com', name: 'person', locale: 'en-US' });
    expect(result).not.toHaveProperty('passwordHash');
  });
});
