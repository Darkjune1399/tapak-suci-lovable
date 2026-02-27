import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle

 } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, Pencil, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithProfile {
  user_id: string;
  role: AppRole;
  created_at: string;
  profile?: { full_name: string | null; member_id: string | null } | null;
  member?: { nama_lengkap: string } | null;
}

export default function UserManagement() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("komite");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [members, setMembers] = useState<{ id: string; nama_lengkap: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Edit state
  const [editingUser, setEditingUser] = useState<UserWithProfile | null>(null);
  const [editRole, setEditRole] = useState<AppRole>("komite");
  const [editMemberId, setEditMemberId] = useState<string>("none");
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [deletingUser, setDeletingUser] = useState<UserWithProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role, created_at");

    if (!roles) { setLoadingUsers(false); return; }

    const userIds = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, member_id")
      .in("user_id", userIds);

    const memberIds = (profiles || []).map((p) => p.member_id).filter(Boolean) as string[];
    const { data: memberData } = memberIds.length > 0
      ? await supabase.from("members").select("id, nama_lengkap").in("id", memberIds)
      : { data: [] };

    const combined: UserWithProfile[] = roles.map((r) => {
      const profile = (profiles || []).find((p) => p.user_id === r.user_id);
      const member = profile?.member_id
        ? (memberData || []).find((m) => m.id === profile.member_id)
        : null;
      return { ...r, profile, member };
    });

    setUsers(combined);
    setLoadingUsers(false);
  };

  const fetchMembers = async () => {
    const { data } = await supabase.from("members").select("id, nama_lengkap").order("nama_lengkap");
    setMembers(data || []);
  };

  useEffect(() => {
    fetchUsers();
    fetchMembers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await supabase.functions.invoke("admin-create-user", {
        body: {
          email,
          password,
          full_name: fullName,
          role: selectedRole,
          member_id: selectedMemberId !== "none" ? selectedMemberId : null,
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast({ title: "User berhasil ditambahkan", description: `${email} sebagai ${selectedRole}` });
      setEmail("");
      setPassword("");
      setFullName("");
      setSelectedMemberId("none");
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (u: UserWithProfile) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditMemberId(u.profile?.member_id || "none");
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    setEditSaving(true);
    try {
      const res = await supabase.functions.invoke("admin-manage-user", {
        body: {
          action: "update",
          user_id: editingUser.user_id,
          role: editRole,
          member_id: editMemberId !== "none" ? editMemberId : null,
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast({ title: "User berhasil diperbarui" });
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      const res = await supabase.functions.invoke("admin-manage-user", {
        body: {
          action: "delete",
          user_id: deletingUser.user_id,
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast({ title: "User berhasil dihapus" });
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const roleLabel = (r: AppRole) => {
    const map: Record<AppRole, string> = { super_admin: "Super Admin", penilai: "Penilai", komite: "Komite" };
    return map[r] || r;
  };

  const requiresMember = selectedRole === "penilai" || selectedRole === "komite";
  const editRequiresMember = editRole === "penilai" || editRole === "komite";

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Kelola User</h1>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Tambah User Baru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Lengkap</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="penilai">Penilai</SelectItem>
                    <SelectItem value="komite">Komite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {requiresMember && (
                <div className="space-y-2">
                  <Label>Kaitkan dengan Anggota {selectedRole === "penilai" ? "(wajib)" : "(opsional)"}</Label>
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger><SelectValue placeholder="Pilih anggota..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Tidak dikaitkan --</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nama_lengkap}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={saving || (selectedRole === "penilai" && selectedMemberId === "none")}>
                {saving ? "Menyimpan..." : "Tambah User"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Daftar User Terdaftar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Anggota Terkait</TableHead>
                    <TableHead className="hidden sm:table-cell">Terdaftar</TableHead>
                    <TableHead className="w-24">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingUsers ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
                  ) : users.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada user</TableCell></TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.profile?.full_name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{roleLabel(u.role)}</Badge>
                        </TableCell>
                        <TableCell>{u.member?.nama_lengkap || "-"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {new Date(u.created_at).toLocaleDateString("id-ID")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(u)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {u.user_id !== currentUser?.id && (
                              <Button size="icon" variant="ghost" onClick={() => setDeletingUser(u)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User: {editingUser?.profile?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="penilai">Penilai</SelectItem>
                  <SelectItem value="komite">Komite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editRequiresMember && (
              <div className="space-y-2">
                <Label>Kaitkan dengan Anggota {editRole === "penilai" ? "(wajib)" : "(opsional)"}</Label>
                <Select value={editMemberId} onValueChange={setEditMemberId}>
                  <SelectTrigger><SelectValue placeholder="Pilih anggota..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Tidak dikaitkan --</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nama_lengkap}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              className="w-full"
              onClick={handleEditSave}
              disabled={editSaving || (editRole === "penilai" && editMemberId === "none")}
            >
              {editSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus User?</AlertDialogTitle>
            <AlertDialogDescription>
              User <strong>{deletingUser?.profile?.full_name}</strong> akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
