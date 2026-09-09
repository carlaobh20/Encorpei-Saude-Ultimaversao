import { useState } from "react";
import { Loader2, Trash2, AlertTriangle, Stethoscope, Baby, Search } from "lucide-react";
import { useAdminUsers, useAdminDeleteUser, type AdminUser } from "@/hooks/useAdminUsers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type UserFilter = "all" | "patients" | "professionals";

const PRO_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Recusado",
};

function DeleteUserDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const deleteUser = useAdminDeleteUser();
  const matches = confirmText.trim().toLowerCase() === user.email.toLowerCase();

  const handleDelete = () => {
    if (!matches) return;
    deleteUser.mutate(user.user_id, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#1c1a1d] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="h-5 w-5" /> Excluir usuário definitivamente
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Isso apaga o login e TODO o histórico de <strong className="text-white">{user.full_name}</strong> ({user.email}).
            Não tem como desfazer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-[12.5px] text-white/60">
            Pra confirmar, digite o e-mail da pessoa: <span className="text-white/80">{user.email}</span>
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={user.email}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/25"
            autoFocus
          />
        </div>

        {deleteUser.isError && (
          <p className="text-[12.5px] text-red-300">
            Não foi possível excluir. {(deleteUser.error as any)?.message}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/5" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!matches || deleteUser.isPending}
            onClick={handleDelete}
          >
            {deleteUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir para sempre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserRow({ item, onDelete }: { item: AdminUser; onDelete: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-white truncate">{item.full_name}</p>
          {item.is_patient && (
            <span className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300">
              <Baby className="h-3 w-3" /> Paciente
            </span>
          )}
          {item.is_professional && (
            <span className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300">
              <Stethoscope className="h-3 w-3" />
              Médico
              {item.professional_approval_status && ` · ${PRO_STATUS_LABEL[item.professional_approval_status] ?? item.professional_approval_status}`}
            </span>
          )}
        </div>
        <p className="text-[12px] text-white/50 mt-1 truncate">{item.email}</p>
        <p className="text-[11px] text-white/35 mt-0.5">
          Cadastro em {new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
      </div>
      <Button size="sm" variant="destructive" className="shrink-0 gap-1.5" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" /> Excluir
      </Button>
    </div>
  );
}

export default function AdminUsersPage() {
  const [filter, setFilter] = useState<UserFilter>("all");
  const [search, setSearch] = useState("");
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const { data: users = [], isLoading, isError, error } = useAdminUsers();

  const filtered = users
    .filter((u) => {
      if (filter === "patients") return u.is_patient;
      if (filter === "professionals") return u.is_professional;
      return true;
    })
    .filter((u) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[760px] mx-auto">
      <header className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="text-sm text-white/50 mt-1">Pacientes e médicos cadastrados no app.</p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as UserFilter)}>
          <SelectTrigger className="h-9 w-[150px] bg-white/5 border-white/10 text-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="patients">Pacientes</SelectItem>
            <SelectItem value="professionals">Médicos</SelectItem>
          </SelectContent>
        </Select>
      </header>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pl-9"
        />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          Não foi possível carregar os usuários. {(error as any)?.message}
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <p className="text-sm text-white/40">Nenhum usuário encontrado.</p>
      )}

      <div className="space-y-3">
        {filtered.map((item) => (
          <UserRow key={item.user_id} item={item} onDelete={() => setUserToDelete(item)} />
        ))}
      </div>

      {userToDelete && <DeleteUserDialog user={userToDelete} onClose={() => setUserToDelete(null)} />}
    </div>
  );
}
