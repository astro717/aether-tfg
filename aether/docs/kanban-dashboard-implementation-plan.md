# Plan de Implementación: Dashboard Kanban con Datos Reales

## 📋 Resumen Ejecutivo

Este documento detalla la estrategia completa para transformar el dashboard Kanban (`OrganizationView.tsx`) de un componente con datos mock a uno completamente funcional que consuma datos reales del backend. El objetivo es mostrar tareas reales organizadas por estado (To Do, In Progress, Done), con toda la información relevante de cada tarea y contadores precisos.

---

## 🎯 Objetivos Principales

1. **Integrar datos reales del backend** - Reemplazar los datos mock por llamadas API reales
2. **Mostrar tareas por estado correcto** - Filtrar y organizar tareas según su estado en la base de datos
3. **Contadores dinámicos precisos** - Mostrar el número real de tareas en cada columna
4. **Información completa de tareas** - Mostrar todos los campos relevantes (asignado, título, fecha límite, etc.)
5. **Sistema de prioridad visual** - Preparar la base para iconos de urgencia (rojo/amarillo/verde) basados en fechas límite

---

## 📊 Análisis del Estado Actual

### Frontend Actual (`OrganizationView.tsx`)

**Estructura:**
- Componente principal: `OrganizationView`
- Subcomponente: `KanbanColumn` - Renderiza cada columna del Kanban
- Subcomponente: `TaskCard` - Renderiza cada tarjeta de tarea individual

**Datos Mock Actuales:**
```typescript
// Ejemplo de tarea mock
{
  id: 1,
  title: "Add dark mode toggle",
  assignedTo: "John Sculley",
  date: "14 Oct",
  priority: "high" | "medium",
  status: "todo" | "in-progress" | "done",
  completed: boolean,
  messages: boolean
}
```

**Problemas Identificados:**
- ✗ Datos hardcodeados en el componente
- ✗ Contadores `total` son valores fijos (3, 4, 2)
- ✗ No hay conexión con el backend
- ✗ Estados de tarea no coinciden con el esquema de BD (`todo` vs `pending`)
- ✗ Campo `assignedTo` es string, debería ser objeto de usuario
- ✗ Campo `date` es string formateado, debería ser `due_date` tipo Date

### Backend Actual

**Modelo de Datos (Prisma Schema):**
```prisma
model tasks {
  id           String    @id @default(uuid())
  repo_id      String?   @db.Uuid
  title        String
  description  String?
  status       String?   @default("pending")
  assignee_id  String?   @db.Uuid
  start_date   DateTime? @default(now())
  due_date     DateTime?
  validated_by String?   @db.Uuid
  created_at   DateTime? @default(now())
  comments     String?
  
  // Relaciones
  users_tasks_assignee_idTousers  users?
  repos                           repos?
  users_tasks_validated_byTousers users?
}
```

**Estados Válidos en BD:**
- `pending` - Equivalente a "To Do"
- `in_progress` - Equivalente a "In Progress"  
- `done` - Equivalente a "Done"

**Endpoints Disponibles:**

1. **GET `/tasks`** - Obtener todas las tareas según rol
   - Manager: todas las tareas
   - User: solo sus tareas asignadas
   - Retorna: `tasks[]`

2. **GET `/tasks/:id`** - Obtener una tarea específica
   - Retorna: `task` individual

3. **POST `/tasks`** - Crear nueva tarea
   - Body: `CreateTaskDto`

4. **PATCH `/tasks/:id`** - Actualizar tarea
   - Body: `UpdateTaskDto`

5. **DELETE `/tasks/:id`** - Eliminar tarea (solo manager)

**Limitaciones del Backend Actual:**
- ⚠️ El endpoint `GET /tasks` NO incluye información del usuario asignado (relación `users`)
- ⚠️ No hay paginación en el endpoint principal
- ⚠️ No hay filtrado por estado en el endpoint
- ⚠️ Falta endpoint para obtener tareas por organización

---

## 🏗️ Arquitectura de la Solución

### Estructura de Capas

```
┌─────────────────────────────────────────┐
│   UI Layer (OrganizationView.tsx)      │
│   - Renderizado de columnas Kanban     │
│   - Gestión de estados UI              │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   API Layer (tasksApi.ts)              │
│   - Llamadas HTTP al backend           │
│   - Transformación de datos            │
│   - Manejo de errores                  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   Backend API (tasks.controller.ts)    │
│   - Endpoints REST                     │
│   - Autenticación JWT                  │
│   - Validación de permisos             │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   Service Layer (tasks.service.ts)     │
│   - Lógica de negocio                  │
│   - Queries a base de datos            │
│   - Relaciones entre entidades         │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   Database (PostgreSQL + Prisma)       │
│   - Tablas: tasks, users, repos        │
└─────────────────────────────────────────┘
```

---

## 🔧 Plan de Implementación Detallado

### FASE 1: Mejoras en el Backend

#### 1.1 Modificar el Servicio de Tareas

**Archivo:** `backend/src/tasks/tasks.service.ts`

**Cambios Necesarios:**

##### A) Modificar `findAllByRole()` para incluir relaciones

**Problema:** Actualmente no incluye información del usuario asignado.

**Solución:**
```typescript
async findAllByRole(user: any) {
  const where = user.role === 'manager' 
    ? {} 
    : { assignee_id: user.id };

  return this.prisma.tasks.findMany({
    where,
    include: {
      users_tasks_assignee_idTousers: {
        select: {
          id: true,
          username: true,
          email: true,
        }
      },
      repos: {
        select: {
          id: true,
          name: true,
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    }
  });
}
```

**Beneficios:**
- ✓ Incluye datos del usuario asignado
- ✓ Incluye información del repositorio
- ✓ Ordenado por fecha de creación
- ✓ Solo campos necesarios (optimización)

##### B) Crear método `findAllByOrganization()`

**Propósito:** Obtener todas las tareas de una organización específica.

**Implementación:**
```typescript
async findAllByOrganization(organizationId: string, userId: string, userRole: string) {
  // Verificar que el usuario pertenece a la organización
  const userOrg = await this.prisma.user_organizations.findUnique({
    where: {
      user_id_organization_id: {
        user_id: userId,
        organization_id: organizationId
      }
    }
  });

  if (!userOrg) {
    throw new ForbiddenException('User does not belong to this organization');
  }

  // Obtener todos los repos de la organización
  const orgRepos = await this.prisma.repos.findMany({
    where: { organization_id: organizationId },
    select: { id: true }
  });

  const repoIds = orgRepos.map(r => r.id);

  // Obtener tareas de esos repos
  return this.prisma.tasks.findMany({
    where: {
      repo_id: { in: repoIds }
    },
    include: {
      users_tasks_assignee_idTousers: {
        select: {
          id: true,
          username: true,
          email: true,
        }
      },
      repos: {
        select: {
          id: true,
          name: true,
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    }
  });
}
```

**Casos de Uso:**
- Dashboard de organización (Kanban view)
- Reportes de equipo
- Métricas de productividad

##### C) Crear método `getTasksByStatus()`

**Propósito:** Obtener tareas agrupadas por estado para el Kanban.

**Implementación:**
```typescript
async getTasksByStatus(organizationId: string, userId: string, userRole: string) {
  const allTasks = await this.findAllByOrganization(organizationId, userId, userRole);

  // Agrupar por estado
  const grouped = {
    pending: allTasks.filter(t => t.status === 'pending'),
    in_progress: allTasks.filter(t => t.status === 'in_progress'),
    done: allTasks.filter(t => t.status === 'done'),
  };

  return {
    pending: grouped.pending,
    in_progress: grouped.in_progress,
    done: grouped.done,
    totals: {
      pending: grouped.pending.length,
      in_progress: grouped.in_progress.length,
      done: grouped.done.length,
      all: allTasks.length
    }
  };
}
```

**Estructura de Respuesta:**
```typescript
{
  pending: Task[],
  in_progress: Task[],
  done: Task[],
  totals: {
    pending: number,
    in_progress: number,
    done: number,
    all: number
  }
}
```

#### 1.2 Modificar el Controlador de Tareas

**Archivo:** `backend/src/tasks/tasks.controller.ts`

**Nuevo Endpoint:**

```typescript
@Get('organization/:organizationId/kanban')
async getKanbanData(
  @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
  @CurrentUser() user: User
) {
  return this.tasksService.getTasksByStatus(organizationId, user.id, user.role);
}
```

**Características:**
- ✓ Requiere autenticación (JwtAuthGuard)
- ✓ Valida UUID de organización
- ✓ Verifica pertenencia del usuario a la organización
- ✓ Retorna datos agrupados por estado

**Ruta Final:** `GET /tasks/organization/:organizationId/kanban`

---

### FASE 2: Capa de API en el Frontend

#### 2.1 Crear Servicio de API de Tareas

**Archivo:** `frontend/src/modules/dashboard/api/tasksApi.ts` (NUEVO)

**Estructura:**

```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Tipos TypeScript
export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Repo {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  repo_id: string | null;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done';
  assignee_id: string | null;
  start_date: string;
  due_date: string | null;
  validated_by: string | null;
  created_at: string;
  comments: string | null;
  
  // Relaciones incluidas
  users_tasks_assignee_idTousers?: User;
  repos?: Repo;
}

export interface KanbanData {
  pending: Task[];
  in_progress: Task[];
  done: Task[];
  totals: {
    pending: number;
    in_progress: number;
    done: number;
    all: number;
  };
}

// Cliente API
class TasksApi {
  private getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }

  async getKanbanData(organizationId: string): Promise<KanbanData> {
    const response = await axios.get<KanbanData>(
      `${API_BASE_URL}/tasks/organization/${organizationId}/kanban`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async getAllTasks(): Promise<Task[]> {
    const response = await axios.get<Task[]>(
      `${API_BASE_URL}/tasks`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async getTaskById(id: string): Promise<Task> {
    const response = await axios.get<Task>(
      `${API_BASE_URL}/tasks/${id}`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    const response = await axios.patch<Task>(
      `${API_BASE_URL}/tasks/${id}`,
      data,
      this.getAuthHeaders()
    );
    return response.data;
  }
}

export const tasksApi = new TasksApi();
```

**Características:**
- ✓ Tipos TypeScript completos
- ✓ Manejo de autenticación JWT
- ✓ Métodos para todas las operaciones necesarias
- ✓ Configuración centralizada de URL base
- ✓ Singleton pattern para instancia única

#### 2.2 Crear Hook Personalizado para Datos del Kanban

**Archivo:** `frontend/src/modules/dashboard/hooks/useKanbanData.ts` (NUEVO)

**Implementación:**

```typescript
import { useState, useEffect } from 'react';
import { tasksApi, KanbanData, Task } from '../api/tasksApi';

interface UseKanbanDataResult {
  data: KanbanData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useKanbanData(organizationId: string | undefined): UseKanbanDataResult {
  const [data, setData] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const kanbanData = await tasksApi.getKanbanData(organizationId);
      setData(kanbanData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch kanban data'));
      console.error('Error fetching kanban data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
```

**Beneficios:**
- ✓ Separación de lógica de datos del componente UI
- ✓ Manejo de estados de carga y error
- ✓ Función `refetch` para recargar datos
- ✓ Reutilizable en múltiples componentes
- ✓ Actualización automática cuando cambia `organizationId`

---

### FASE 3: Actualización del Componente UI

#### 3.1 Modificar OrganizationView.tsx

**Archivo:** `frontend/src/modules/dashboard/components/OrganizationView.tsx`

**Cambios Principales:**

##### A) Importaciones y Setup

```typescript
import { Check, Flame, AlertTriangle, MessageCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useKanbanData } from "../hooks/useKanbanData";
import { Task } from "../api/tasksApi";

// Obtener organizationId del contexto o props
// (Asumiendo que existe un contexto de organización)
import { useOrganization } from "../../organization/hooks/useOrganization";
```

##### B) Lógica del Componente

```typescript
export function OrganizationView() {
  const { currentOrganization } = useOrganization();
  const { data, loading, error, refetch } = useKanbanData(currentOrganization?.id);

  // Estado de carga
  if (loading) {
    return (
      <div className="flex-1 w-full h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Estado de error
  if (error) {
    return (
      <div className="flex-1 w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error loading tasks: {error.message}</p>
          <button 
            onClick={refetch}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Sin datos
  if (!data) {
    return (
      <div className="flex-1 w-full h-full flex items-center justify-center">
        <p className="text-gray-400">No organization selected</p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full overflow-x-auto overflow-y-hidden flex flex-col h-full">
      <div className="flex items-stretch px-8 pb-8 pt-12 flex-1 h-full">
        
        {/* To Do Column */}
        <div className="relative z-10 flex-1 min-w-[350px] flex flex-col">
          <KanbanColumn
            title="To Do"
            total={data.totals.pending}
            width="w-full"
            contentOffset="pr-[140px]"
            tasks={data.pending}
          />
        </div>

        {/* In Progress Column */}
        <div className="relative z-30 -ml-[100px] flex-1 min-w-[390px] flex flex-col">
          <KanbanColumn
            title="In Progress"
            total={data.totals.in_progress}
            width="w-full"
            contentOffset="pl-5"
            tasks={data.in_progress}
          />
        </div>

        {/* Done Column */}
        <div className="relative z-10 -ml-[100px] flex-1 min-w-[350px] flex flex-col">
          <KanbanColumn
            title="Done"
            total={data.totals.done}
            width="w-full"
            contentOffset="pl-[120px]"
            tasks={data.done}
          />
        </div>

      </div>
    </div>
  );
}
```

##### C) Actualizar KanbanColumn

```typescript
function KanbanColumn({
  title,
  tasks,
  total,
  width = "w-[350px]",
  contentOffset = "",
}: {
  title: string;
  tasks: Task[];  // Tipo actualizado
  total: number;
  width?: string;
  contentOffset?: string;
}) {
  return (
    <div className={`flex flex-col ${width} bg-white/40 backdrop-blur-xl rounded-[40px] p-4 border border-white/40 shadow-xl transition-all hover:z-40 h-full`}>
      
      <h3 className={`text-gray-500 font-medium mb-3 text-lg tracking-wide flex items-center justify-between ${contentOffset}`}>
        {title}
      </h3>

      <div className={`flex-1 space-y-3 overflow-y-auto ${contentOffset}`}>
        {tasks.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <Link to={`/tasks/${task.id}`} key={task.id} className="block group">
              <TaskCard task={task} />
            </Link>
          ))
        )}
      </div>

      <div className={`mt-4 text-gray-400 text-sm font-medium ${contentOffset}`}>
        total <span className="text-gray-500 ml-1">{total}</span>
      </div>
    </div>
  );
}
```

##### D) Actualizar TaskCard

```typescript
function TaskCard({ task }: { task: Task }) {
  // Calcular prioridad basada en fecha límite
  const priority = calculatePriority(task.due_date);
  
  // Formatear fecha
  const formattedDate = task.due_date 
    ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : 'No deadline';

  // Obtener iniciales del usuario
  const userInitials = task.users_tasks_assignee_idTousers?.username
    ? task.users_tasks_assignee_idTousers.username.substring(0, 1).toUpperCase()
    : '?';

  const userName = task.users_tasks_assignee_idTousers?.username || 'Unassigned';

  return (
    <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[24px] p-3 shadow-sm hover:scale-[1.02] hover:shadow-lg transition-all duration-200 cursor-pointer hover:bg-white/95 w-full">
      
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[9px] font-bold shadow-sm">
            {userInitials}
          </div>
          <span className="text-xs font-bold text-gray-800 tracking-tight">
            {userName}
          </span>
        </div>

        {/* Priority Icon */}
        <div className="text-gray-400">
          {task.status === 'done' && <Check size={14} className="text-gray-400" />}
          {priority === 'high' && <AlertTriangle size={14} className="text-red-400 fill-red-400/10" />}
          {priority === 'medium' && <Flame size={14} className="text-yellow-400 fill-yellow-400" />}
          {priority === 'low' && <MessageCircle size={14} className="text-green-500 fill-green-500" />}
        </div>
      </div>

      {/* Title */}
      <h4 className="text-gray-600 text-[13px] font-medium mb-2 leading-tight pl-1">
        {task.title}
      </h4>

      {/* Footer */}
      <div className="flex items-center justify-between pl-1">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
          {formattedDate}
        </span>
      </div>
    </div>
  );
}
```

##### E) Función de Cálculo de Prioridad

```typescript
/**
 * Calcula la prioridad visual basada en la fecha límite
 * - high: menos de 3 días
 * - medium: entre 3 y 7 días
 * - low: más de 7 días o sin fecha
 */
function calculatePriority(dueDate: string | null): 'high' | 'medium' | 'low' {
  if (!dueDate) return 'low';

  const now = new Date();
  const deadline = new Date(dueDate);
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'high'; // Vencida
  if (diffDays <= 3) return 'high';
  if (diffDays <= 7) return 'medium';
  return 'low';
}
```

---

### FASE 4: Gestión del Contexto de Organización

#### 4.1 Crear Contexto de Organización (si no existe)

**Archivo:** `frontend/src/modules/organization/context/OrganizationContext.tsx` (NUEVO)

**Propósito:** Mantener la organización actual seleccionada disponible en toda la aplicación.

**Implementación:**

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';

interface Organization {
  id: string;
  name: string;
  created_at: string;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization | null) => void;
  organizations: Organization[];
  setOrganizations: (orgs: Organization[]) => void;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  // Cargar organización desde localStorage al iniciar
  useEffect(() => {
    const savedOrgId = localStorage.getItem('currentOrganizationId');
    if (savedOrgId && organizations.length > 0) {
      const org = organizations.find(o => o.id === savedOrgId);
      if (org) setCurrentOrganization(org);
    }
  }, [organizations]);

  // Guardar organización en localStorage cuando cambie
  useEffect(() => {
    if (currentOrganization) {
      localStorage.setItem('currentOrganizationId', currentOrganization.id);
    } else {
      localStorage.removeItem('currentOrganizationId');
    }
  }, [currentOrganization]);

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        setCurrentOrganization,
        organizations,
        setOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}
```

#### 4.2 Integrar Provider en la Aplicación

**Archivo:** `frontend/src/App.tsx`

```typescript
import { OrganizationProvider } from './modules/organization/context/OrganizationContext';

function App() {
  return (
    <OrganizationProvider>
      {/* Resto de la aplicación */}
    </OrganizationProvider>
  );
}
```

---

## 🎨 Sistema de Prioridad Visual (Preparación)

### Lógica de Colores por Urgencia

**Criterios de Clasificación:**

| Prioridad | Días Restantes | Color | Icono | Descripción |
|-----------|----------------|-------|-------|-------------|
| **High** (Urgente) | < 3 días o vencida | Rojo (`#EF4444`) | `AlertTriangle` | Requiere atención inmediata |
| **Medium** (Importante) | 3-7 días | Amarillo (`#FBBF24`) | `Flame` | Requiere planificación |
| **Low** (Lejana) | > 7 días | Verde (`#10B981`) | `MessageCircle` | Tiempo suficiente |

**Implementación Visual:**

```typescript
const priorityStyles = {
  high: {
    icon: AlertTriangle,
    color: 'text-red-400',
    fill: 'fill-red-400/10',
    badge: 'bg-red-100 text-red-500'
  },
  medium: {
    icon: Flame,
    color: 'text-yellow-400',
    fill: 'fill-yellow-400',
    badge: 'bg-orange-100 text-orange-500'
  },
  low: {
    icon: MessageCircle,
    color: 'text-green-500',
    fill: 'fill-green-500',
    badge: 'bg-green-100 text-green-600'
  }
};
```

**Casos Especiales:**
- ✓ Tareas sin `due_date`: Prioridad baja por defecto
- ✓ Tareas completadas (`status: 'done'`): Icono de check, sin color de prioridad
- ✓ Tareas vencidas: Prioridad alta automáticamente

---

## 🔄 Flujo de Datos Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuario accede al Dashboard                             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 2. OrganizationView se monta                                │
│    - Obtiene organizationId del contexto                    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 3. useKanbanData hook se ejecuta                            │
│    - Llama a tasksApi.getKanbanData(organizationId)         │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 4. Request HTTP al Backend                                  │
│    GET /tasks/organization/:organizationId/kanban           │
│    Headers: { Authorization: "Bearer <token>" }             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 5. Backend procesa request                                  │
│    - Valida JWT token                                       │
│    - Verifica pertenencia a organización                    │
│    - Ejecuta getTasksByStatus()                             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 6. Prisma consulta la base de datos                         │
│    - Obtiene tareas de repos de la organización             │
│    - Incluye relaciones (users, repos)                      │
│    - Agrupa por estado                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 7. Response enviada al Frontend                             │
│    {                                                        │
│      pending: Task[],                                       │
│      in_progress: Task[],                                   │
│      done: Task[],                                          │
│      totals: { ... }                                        │
│    }                                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 8. useKanbanData actualiza estado                           │
│    - setData(response)                                      │
│    - setLoading(false)                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 9. OrganizationView re-renderiza                            │
│    - Pasa datos a KanbanColumn components                   │
│    - Muestra contadores reales                              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 10. TaskCard renderiza cada tarea                           │
│     - Calcula prioridad basada en due_date                  │
│     - Muestra información del usuario asignado              │
│     - Formatea fechas                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Checklist de Implementación

### Backend

- [ ] **Modificar `tasks.service.ts`**
  - [ ] Actualizar `findAllByRole()` para incluir relaciones
  - [ ] Crear método `findAllByOrganization()`
  - [ ] Crear método `getTasksByStatus()`
  - [ ] Agregar validación de pertenencia a organización

- [ ] **Modificar `tasks.controller.ts`**
  - [ ] Crear endpoint `GET /tasks/organization/:organizationId/kanban`
  - [ ] Agregar validación de UUID
  - [ ] Configurar guards de autenticación

- [ ] **Testing Backend**
  - [ ] Probar endpoint con Postman/Insomnia
  - [ ] Verificar que incluye relaciones correctamente
  - [ ] Verificar agrupación por estado
  - [ ] Verificar contadores

### Frontend - API Layer

- [ ] **Crear `tasksApi.ts`**
  - [ ] Definir interfaces TypeScript
  - [ ] Implementar clase TasksApi
  - [ ] Configurar headers de autenticación
  - [ ] Crear método `getKanbanData()`
  - [ ] Exportar instancia singleton

- [ ] **Crear `useKanbanData.ts`**
  - [ ] Implementar hook con useState/useEffect
  - [ ] Manejar estados de loading/error
  - [ ] Implementar función refetch
  - [ ] Agregar logs de debugging

### Frontend - UI Layer

- [ ] **Modificar `OrganizationView.tsx`**
  - [ ] Importar hook `useKanbanData`
  - [ ] Implementar estados de loading/error
  - [ ] Pasar datos reales a `KanbanColumn`
  - [ ] Actualizar contadores con `data.totals`

- [ ] **Actualizar `KanbanColumn`**
  - [ ] Cambiar tipo de props `tasks` a `Task[]`
  - [ ] Manejar caso de array vacío
  - [ ] Usar contador dinámico `total`

- [ ] **Actualizar `TaskCard`**
  - [ ] Implementar función `calculatePriority()`
  - [ ] Formatear `due_date` correctamente
  - [ ] Mostrar iniciales del usuario asignado
  - [ ] Mostrar nombre de usuario
  - [ ] Aplicar iconos de prioridad dinámicamente

### Contexto de Organización

- [ ] **Crear `OrganizationContext.tsx`**
  - [ ] Implementar context y provider
  - [ ] Agregar persistencia en localStorage
  - [ ] Crear hook `useOrganization()`

- [ ] **Integrar en `App.tsx`**
  - [ ] Envolver aplicación con `OrganizationProvider`

### Testing E2E

- [ ] **Verificar flujo completo**
  - [ ] Login de usuario
  - [ ] Selección de organización
  - [ ] Carga de dashboard
  - [ ] Visualización de tareas por estado
  - [ ] Contadores correctos
  - [ ] Información de usuario asignado
  - [ ] Fechas formateadas
  - [ ] Iconos de prioridad

---

## 🚨 Consideraciones Importantes

### Seguridad

1. **Autenticación JWT**
   - ✓ Todos los endpoints requieren token válido
   - ✓ Token almacenado en localStorage
   - ✓ Headers incluidos en todas las requests

2. **Autorización**
   - ✓ Verificar pertenencia a organización antes de mostrar tareas
   - ✓ Managers ven todas las tareas, users solo las asignadas
   - ✓ Validación en backend, no solo frontend

3. **Validación de Datos**
   - ✓ UUIDs validados con `ParseUUIDPipe`
   - ✓ DTOs con class-validator
   - ✓ Manejo de errores en frontend

### Performance

1. **Optimización de Queries**
   - ✓ Usar `select` para incluir solo campos necesarios
   - ✓ Evitar N+1 queries con `include`
   - ✓ Indexar campos frecuentemente consultados (`status`, `organization_id`)

2. **Caching (Futuro)**
   - Considerar React Query para cache automático
   - Implementar invalidación de cache al actualizar tareas
   - Cache de organizaciones del usuario

3. **Paginación (Futuro)**
   - Actualmente carga todas las tareas
   - Implementar paginación si el número de tareas crece
   - Lazy loading en columnas del Kanban

### UX/UI

1. **Estados de Carga**
   - ✓ Spinner mientras carga datos
   - ✓ Mensaje de error con botón de retry
   - ✓ Estado vacío cuando no hay tareas

2. **Feedback Visual**
   - ✓ Hover effects en tarjetas
   - ✓ Transiciones suaves
   - ✓ Colores de prioridad claros

3. **Accesibilidad**
   - Agregar aria-labels a botones
   - Asegurar contraste de colores
   - Navegación por teclado

---

## 🔮 Mejoras Futuras

### Funcionalidades Adicionales

1. **Drag & Drop**
   - Mover tareas entre columnas
   - Actualizar estado automáticamente
   - Librería: `@dnd-kit/core`

2. **Filtros y Búsqueda**
   - Filtrar por usuario asignado
   - Filtrar por repositorio
   - Búsqueda por título/descripción
   - Filtrar por rango de fechas

3. **Ordenamiento**
   - Por fecha de creación
   - Por fecha límite
   - Por prioridad
   - Alfabético

4. **Métricas y Analytics**
   - Tiempo promedio en cada estado
   - Tareas completadas por usuario
   - Gráficos de productividad
   - Burndown charts

5. **Notificaciones**
   - Alertas de tareas próximas a vencer
   - Notificaciones de nuevas asignaciones
   - Recordatorios automáticos

6. **Comentarios en Tareas**
   - Actualmente el campo `comments` es un string
   - Migrar a tabla separada `task_comments`
   - Sistema de hilos de conversación

### Optimizaciones Técnicas

1. **WebSockets**
   - Actualizaciones en tiempo real
   - Múltiples usuarios viendo el mismo Kanban
   - Sincronización automática

2. **Optimistic Updates**
   - Actualizar UI antes de confirmar con backend
   - Rollback en caso de error
   - Mejor UX percibida

3. **Service Workers**
   - Modo offline
   - Cache de datos
   - Sincronización cuando vuelve conexión

---

## 📚 Recursos y Referencias

### Documentación

- [Prisma Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)
- [NestJS Guards](https://docs.nestjs.com/guards)
- [React Context API](https://react.dev/reference/react/useContext)
- [Axios Documentation](https://axios-http.com/docs/intro)

### Librerías Recomendadas

- **React Query** - Gestión de estado del servidor
- **@dnd-kit** - Drag and drop
- **date-fns** - Manipulación de fechas
- **zod** - Validación de schemas TypeScript

### Herramientas de Testing

- **Postman** - Testing de endpoints
- **React Testing Library** - Testing de componentes
- **Jest** - Framework de testing
- **Cypress** - E2E testing

---

## ✅ Criterios de Éxito

La implementación será considerada exitosa cuando:

1. ✅ **Datos Reales**
   - Las tareas mostradas provienen del backend
   - No hay datos mock en el código

2. ✅ **Organización Correcta**
   - Tareas agrupadas por estado correcto
   - Columnas muestran solo tareas del estado correspondiente

3. ✅ **Contadores Precisos**
   - `total` refleja el número real de tareas en cada columna
   - Suma de contadores coincide con total de tareas

4. ✅ **Información Completa**
   - Nombre del usuario asignado visible
   - Título de tarea correcto
   - Fecha límite formateada
   - Iconos de prioridad basados en fechas

5. ✅ **Manejo de Errores**
   - Errores de red manejados gracefully
   - Mensajes de error claros al usuario
   - Opción de reintentar

6. ✅ **Performance**
   - Carga inicial < 2 segundos
   - Sin lag al renderizar tareas
   - Transiciones suaves

7. ✅ **Seguridad**
   - Solo usuarios autenticados acceden
   - Solo ven tareas de su organización
   - Tokens JWT validados

---

## 📞 Notas Finales

Este plan proporciona una hoja de ruta completa para implementar la funcionalidad del dashboard Kanban con datos reales. Los pasos están diseñados para ser implementados de forma incremental, permitiendo testing y validación en cada fase.

**Orden de Implementación Recomendado:**
1. Backend (FASE 1) - Base sólida de datos
2. API Layer (FASE 2) - Comunicación con backend
3. UI Layer (FASE 3) - Visualización de datos
4. Contexto (FASE 4) - Gestión de estado global

**Tiempo Estimado:**
- Backend: 3-4 horas
- Frontend API: 2-3 horas
- Frontend UI: 3-4 horas
- Testing e integración: 2-3 horas
- **Total: 10-14 horas**

¡Buena suerte con la implementación! 🚀
