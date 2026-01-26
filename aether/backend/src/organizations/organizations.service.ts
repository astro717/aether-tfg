import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  // Get all organizations a user belongs to
  async findUserOrganizations(userId: string) {
    const userOrgs = await this.prisma.user_organizations.findMany({
      where: { user_id: userId },
      include: {
        organizations: {
          select: {
            id: true,
            name: true,
            created_at: true,
          },
        },
      },
    });
    return userOrgs.map((uo) => uo.organizations);
  }

  // Validate user belongs to organization
  async validateMembership(userId: string, organizationId: string) {
    const membership = await this.prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: userId,
          organization_id: organizationId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'User does not belong to this organization',
      );
    }

    return membership;
  }

  // Get single organization
  async findOne(organizationId: string, userId: string) {
    await this.validateMembership(userId, organizationId);

    return this.prisma.organizations.findUnique({
      where: { id: organizationId },
      include: {
        user_organizations: {
          include: {
            users: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  // Create organization
  async create(name: string, creatorId: string) {
    return this.prisma.organizations.create({
      data: {
        name,
        user_organizations: {
          create: {
            role_in_org: 'admin',
            users: {
              connect: { id: creatorId },
            },
          },
        },
      },
    });
  }
}
