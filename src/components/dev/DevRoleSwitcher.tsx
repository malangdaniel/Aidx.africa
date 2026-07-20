import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Stethoscope, Pill, Shield } from 'lucide-react';
import sanariLogo from '@/assets/sanari-logo.png';

type DevRole = 'patient' | 'doctor' | 'pharmacist' | 'admin';

interface DevRoleSwitcherProps {
  onSelectRole: (role: DevRole) => void;
}

const roles = [
  { id: 'patient' as DevRole, label: 'Patient', icon: User, color: 'bg-primary' },
  { id: 'doctor' as DevRole, label: 'Doctor', icon: Stethoscope, color: 'bg-secondary' },
  { id: 'pharmacist' as DevRole, label: 'Pharmacist', icon: Pill, color: 'bg-primary' },
  { id: 'admin' as DevRole, label: 'Admin', icon: Shield, color: 'bg-secondary' },
];

export function DevRoleSwitcher({ onSelectRole }: DevRoleSwitcherProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <img src={sanariLogo} alt="Sanari AI" className="h-10 w-auto" />
          </div>
          <div className="mx-auto mb-2 px-2.5 py-0.5 bg-destructive/10 text-destructive text-[10px] font-semibold rounded-full w-fit uppercase tracking-wide">
            Dev Mode
          </div>
          <CardTitle className="text-lg">Role Switcher</CardTitle>
          <p className="text-muted-foreground text-xs mt-1">
            Select a role to test the app
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 pt-0">
          {roles.map((role) => (
            <Button
              key={role.id}
              variant="outline"
              className="h-20 flex flex-col gap-1.5 hover:border-primary transition-all"
              onClick={() => onSelectRole(role.id)}
            >
              <div className={`p-2 rounded-full ${role.color}`}>
                <role.icon className="h-4 w-4 text-white" />
              </div>
              <span className="font-medium text-sm">{role.label}</span>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
