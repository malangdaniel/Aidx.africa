import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Stethoscope, Pill, Shield } from 'lucide-react';

type DevRole = 'patient' | 'doctor' | 'pharmacist' | 'admin';

interface DevRoleSwitcherProps {
  onSelectRole: (role: DevRole) => void;
}

const roles = [
  { id: 'patient' as DevRole, label: 'Patient', icon: User, color: 'bg-blue-500' },
  { id: 'doctor' as DevRole, label: 'Doctor', icon: Stethoscope, color: 'bg-green-500' },
  { id: 'pharmacist' as DevRole, label: 'Pharmacist', icon: Pill, color: 'bg-purple-500' },
  { id: 'admin' as DevRole, label: 'Admin', icon: Shield, color: 'bg-red-500' },
];

export function DevRoleSwitcher({ onSelectRole }: DevRoleSwitcherProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 px-3 py-1 bg-destructive/10 text-destructive text-xs font-semibold rounded-full w-fit">
            DEV MODE
          </div>
          <CardTitle className="text-2xl">Role Switcher</CardTitle>
          <p className="text-muted-foreground text-sm mt-2">
            Select a role to test the application without authentication
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {roles.map((role) => (
            <Button
              key={role.id}
              variant="outline"
              className="h-24 flex flex-col gap-2 hover:border-primary"
              onClick={() => onSelectRole(role.id)}
            >
              <div className={`p-2 rounded-full ${role.color}`}>
                <role.icon className="h-5 w-5 text-white" />
              </div>
              <span className="font-medium">{role.label}</span>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
