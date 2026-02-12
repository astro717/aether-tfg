import { Injectable, ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) { }

  // Get all organizations a user belongs to (with user's role in each)
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
    return userOrgs.map((uo) => ({
      ...uo.organizations,
      role_in_org: uo.role_in_org,
    }));
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
                avatar_color: true,
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

  // Get user's role in organization
  async getUserRoleInOrg(userId: string, organizationId: string): Promise<string | null> {
    const membership = await this.prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: userId,
          organization_id: organizationId,
        },
      },
    });
    return membership?.role_in_org || null;
  }

  // Change user role in organization (admin/manager only)
  async changeUserRole(
    organizationId: string,
    targetUserId: string,
    newRole: 'admin' | 'manager' | 'member',
    requesterId: string,
  ) {
    // Verify requester is admin in this organization
    const requesterMembership = await this.prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: requesterId,
          organization_id: organizationId,
        },
      },
    });

    const requesterRole = requesterMembership?.role_in_org;
    if (!requesterMembership || (requesterRole !== 'admin' && requesterRole !== 'manager')) {
      throw new ForbiddenException('Only admins and managers can change user roles');
    }

    // Verify target user belongs to organization
    const targetMembership = await this.prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: targetUserId,
          organization_id: organizationId,
        },
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('User is not a member of this organization');
    }

    // Prevent admin from demoting themselves if they're the last admin
    if (targetUserId === requesterId && newRole !== 'admin') {
      const adminCount = await this.prisma.user_organizations.count({
        where: {
          organization_id: organizationId,
          role_in_org: 'admin',
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the last admin of the organization');
      }
    }

    // Update role
    const updated = await this.prisma.user_organizations.update({
      where: {
        user_id_organization_id: {
          user_id: targetUserId,
          organization_id: organizationId,
        },
      },
      data: {
        role_in_org: newRole,
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
          },
        },
      },
    });

    return {
      user: updated.users,
      role_in_org: updated.role_in_org,
    };
  }

  // Get organization members with their roles
  async getOrganizationMembers(organizationId: string, requesterId: string) {
    await this.validateMembership(requesterId, organizationId);

    const members = await this.prisma.user_organizations.findMany({
      where: { organization_id: organizationId },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
          },
        },
      },
    });

    return members.map((m) => ({
      ...m.users,
      role_in_org: m.role_in_org,
    }));
  }

  // Centralized Access Check
  async checkAccess(user: any, organizationId: string, allowedRoles: string[] = ['admin', 'manager']) {
    // 1. Global Manager Override
    if (user.role === 'manager') {
      return { authorized: true, role: 'global_manager' };
    }

    // 2. Org Role Check
    const membership = await this.prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: user.id,
          organization_id: organizationId,
        },
      },
    });

    if (!membership || !membership.role_in_org || !allowedRoles.includes(membership.role_in_org)) {
      throw new ForbiddenException('Insufficient permissions in this organization');
    }

    return { authorized: true, role: membership.role_in_org };
  }
}
