import { OrganizationsService } from '../src/organizations/organizations.service';
import { ForbiddenException } from '@nestjs/common';

// Simple mock implementation
const createMock = () => {
    const mock: any = (...args: any[]) => {
        return mock.implementation ? mock.implementation(...args) : Promise.resolve();
    };
    mock.mockResolvedValue = (val: any) => {
        mock.implementation = () => Promise.resolve(val);
    };
    mock.implementation = undefined;
    return mock;
};

// Manual Mock for PrismaService
const mockPrismaService = {
    user_organizations: {
        findUnique: createMock(),
    },
} as any;

async function runVerification() {
    console.log('Starting Verification for OrganizationsService.checkAccess (Standalone)...');

    const service = new OrganizationsService(mockPrismaService);
    const orgId = 'org-123';

    // Test Case 1: Global Manager Override
    console.log('\nTest 1: Global Manager Override');
    const globalManager = { id: 'user-1', role: 'manager' };
    try {
        const result = await service.checkAccess(globalManager, orgId, ['admin']);
        if (result.authorized && result.role === 'global_manager') {
            console.log('✅ PASS: Global Manager granted access as global_manager');
        } else {
            throw new Error(`❌ FAIL: Unexpected result for global manager: ${JSON.stringify(result)}`);
        }
    } catch (error) {
        console.error('❌ FAIL: Global Manager was denied access', error);
        throw error;
    }

    // Test Case 2: Org Admin Access
    console.log('\nTest 2: Org Admin Access');
    const orgAdmin = { id: 'user-2', role: 'user' };
    mockPrismaService.user_organizations.findUnique.mockResolvedValue({
        user_id: 'user-2',
        organization_id: orgId,
        role_in_org: 'admin',
    });

    try {
        const result = await service.checkAccess(orgAdmin, orgId, ['admin', 'manager']);
        if (result.authorized && result.role === 'admin') {
            console.log('✅ PASS: Org Admin granted access');
        } else {
            throw new Error(`❌ FAIL: Unexpected result for Org Admin: ${JSON.stringify(result)}`);
        }
    } catch (error) {
        console.error('❌ FAIL: Org Admin was denied access', error);
        throw error;
    }

    // Test Case 3: Org Member Denial
    console.log('\nTest 3: Org Member Denial');
    const orgMember = { id: 'user-3', role: 'user' };
    mockPrismaService.user_organizations.findUnique.mockResolvedValue({
        user_id: 'user-3',
        organization_id: orgId,
        role_in_org: 'member',
    });

    try {
        await service.checkAccess(orgMember, orgId, ['admin', 'manager']);
        throw new Error('❌ FAIL: Org Member should have been denied access');
    } catch (error) {
        if (error instanceof ForbiddenException) {
            console.log('✅ PASS: Org Member correctly denied access');
        } else {
            console.error('❌ FAIL: Unexpected error type', error);
            throw error;
        }
    }

    // Test Case 4: Non-Member Denial
    console.log('\nTest 4: Non-Member Denial');
    const nonMember = { id: 'user-4', role: 'user' };
    mockPrismaService.user_organizations.findUnique.mockResolvedValue(null);

    try {
        await service.checkAccess(nonMember, orgId, ['admin', 'manager']);
        throw new Error('❌ FAIL: Non-Member should have been denied access');
    } catch (error) {
        if (error instanceof ForbiddenException) {
            console.log('✅ PASS: Non-Member correctly denied access');
        } else {
            console.error('❌ FAIL: Unexpected error type', error);
            throw error;
        }
    }

    console.log('\n✅ Verification Complete: All tests passed.');
}

runVerification().catch(err => {
    console.error('Verification Failed:', err);
    process.exit(1);
});
