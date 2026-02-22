import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface WalletViewProps {
    balance: number;
    escrow: number;
}

export default function WalletView({ balance, escrow }: WalletViewProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Wallet</h2>
            <div className="grid gap-3">
                <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-none shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₦{balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
                        <Button className="mt-3 w-full" size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Funds
                        </Button>
                    </CardContent>
                </Card>
                <Card className="border-dashed">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Escrow Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold opacity-80">₦{escrow.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Funds currently held for pending pharmacy orders</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
