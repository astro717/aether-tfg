# Product Specification: Aether

## Product Overview
**Aether** is a modern project management and collaboration platform designed to help teams organize work, track progress, and communicate effectively. It features a clean, responsive interface with real-time updates.

## Core Purpose
To provide a seamless environment for managing tasks and workflows within organizations, allowing users to visualize project status through a Kanban board and quickly access their personal responsibilities.

## Key Features & Functionality

### 1. User Authentication
*   **Registration/Login**: Secure email/password authentication.
*   **User Context**: The application maintains a session for the logged-in user to personalize the experience and enforce permissions.

### 2. Organization Management
*   **Multi-tenancy**: Users can belong to multiple organizations.
*   **Switcher**: A context switcher allows users to toggle between different organizations they are a member of.

### 3. Dashboard (Kanban Board)
The central hub for project tracking.
*   **Columns**: Work is organized into "To Do", "In Progress", and "Done" stages.
*   **Task Cards**: Each card displays the task title, assignee avatar, due date, and priority status.
*   **Drag & Drop Interactions**:
    *   Users can drag tasks between columns to update their status.
    *   **Permission Rule**: A user can **only** move tasks that are assigned to them. Dragging another user's task will result in the action being rejected (visual snap-back).
*   **Column Counters**: Real-time counters at the bottom of each column show the total number of tasks in that stage.

### 4. Sidebar Navigation & Personal Workspace
*   **Personalization**: Displays the logged-in user's name and avatar.
*   **"Tasks" Section**:
    *   A dedicated list showing **only** the tasks assigned to the current user.
    *   **Priority Indicators**: Color-coded dots indicate task urgency:
        *   🔴 **Red**: High Priority (Overdue or due within 3 days).
        *   🟡 **Yellow**: Medium Priority (Due within 7 days).
        *   🟢 **Green**: Low Priority (Due in > 7 days).
*   **Navigation**: Clicking a task in the sidebar takes the user directly to that task's details.

## Technical Constraints for Testing
*   **Test User**: `test2@example.com`
*   **Permissions**: Testing requires verifying that actions (like dragging a card) are restricted based on the logged-in user's ID matching the task's `assignee_id`.
