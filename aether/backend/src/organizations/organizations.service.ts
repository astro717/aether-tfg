import { Injectable, ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
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

  // Add user to organization
  async addUser(organizationId: string, userId: string, role: string = 'member') {
    return this.prisma.user_organizations.create({
      data: {
        user_id: userId,
        organization_id: organizationId,
        role_in_org: role,
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

  // Join an existing organization
  async joinOrganization(userId: string, organizationId: string) {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(organizationId)) {
      throw new BadRequestException('Invalid organization ID format');
    }

    // Check if organization exists
    const organization = await this.prisma.organizations.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Check if user is already a member
    const existingMembership = await this.prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: userId,
          organization_id: organizationId,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('You are already a member of this organization');
    }

    // Add user to organization as member
    await this.prisma.user_organizations.create({
      data: {
        user_id: userId,
        organization_id: organizationId,
        role_in_org: 'member',
      },
    });

    return {
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
      },
    };
  }
}
