import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil } from "lucide-react";

const KATEGORI_OPTIONS = ["Tanding", "Pemasalan", "Prestasi", "Seni"];
const UMUR_OPTIONS = ["Pra Usia Dini", "Usia Dini 1", "Usia Dini 2", "Pra-Remaja", "Remaja", "Dewasa"];
const GENDER_OPTIONS = [
  { value: "putra", label: "Putra" },
  { value: "putri", label: "Putri" },
];

interface MasterCategory {
  id: string;
  nama_kategori: string;
  kelompok_umur: string;
  jenis_kelamin: string;
  berat_min: number | null;
  berat_max: number | null;
  keterangan: string | null;
}

export default function MasterCategories() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MasterCategory | null>(null);

  const canEdit = role === "super_admin" || role === "komite";

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from("master_competition_categories")
      .select("*")
      .order("nama_kategori")
      .order("kelompok_umur")
      .order("jenis_kelamin");
    setCategories((data as MasterCategory[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleSave = async (form: Omit<MasterCategory, "id">) => {
    if (editing) {
      const { error } = await supabase
        .from("master_competition_categories")
        .update(form)
        .eq("id", editing.id);
      if (error) {
        toast({ title: "Gagal mengupdate", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Kategori diupdate" });
    } else {
      const { error } = await supabase
        .from("master_competition_categories")
        .insert(form);
      if (error) {
        toast({ title: "Gagal menambah", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Kategori ditambahkan" });
    }
    setDialogOpen(false);
    setEditing(null);
    fetchCategories();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("master_competition_categories").delete().eq("id", id);
    if (error) toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
    else fetchCategories();
  };

  const openEdit = (cat: MasterCategory) => {
    setEditing(cat);
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Master Kategori Kompetisi</h1>
            <p className="text-sm text-muted-foreground">Kelola daftar kategori yang dapat digunakan di setiap kompetisi</p>
          </div>
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Tambah Kategori</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
                </DialogHeader>
                <MasterCategoryForm initial={editing} onSave={handleSave} />
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Kategori</TableHead>
                  <TableHead>Kelompok Umur</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Berat (kg)</TableHead>
                  <TableHead>Keterangan</TableHead>
                  {canEdit && <TableHead className="w-24">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
                ) : categories.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Belum ada kategori master</TableCell></TableRow>
                ) : (
                  categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.nama_kategori}</TableCell>
                      <TableCell>{cat.kelompok_umur}</TableCell>
                      <TableCell>{cat.jenis_kelamin === "putra" ? "Putra" : "Putri"}</TableCell>
                      <TableCell>
                        {cat.berat_min != null && cat.berat_max != null
                          ? `${cat.berat_min} - ${cat.berat_max}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{cat.keterangan || "-"}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(cat)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(cat.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function MasterCategoryForm({
  initial,
  onSave,
}: {
  initial: MasterCategory | null;
  onSave: (form: Omit<MasterCategory, "id">) => void;
}) {
  const [form, setForm] = useState({
    nama_kategori: initial?.nama_kategori || "Tanding",
    kelompok_umur: initial?.kelompok_umur || "Dewasa",
    jenis_kelamin: initial?.jenis_kelamin || "putra",
    berat_min: initial?.berat_min?.toString() || "",
    berat_max: initial?.berat_max?.toString() || "",
    keterangan: initial?.keterangan || "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nama Kategori *</Label>
        <Select value={form.nama_kategori} onValueChange={(v) => set("nama_kategori", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {KATEGORI_OPTIONS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Kelompok Umur *</Label>
          <Select value={form.kelompok_umur} onValueChange={(v) => set("kelompok_umur", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {UMUR_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Jenis Kelamin</Label>
          <Select value={form.jenis_kelamin} onValueChange={(v) => set("jenis_kelamin", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {form.nama_kategori === "Tanding" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Berat Min (kg)</Label>
            <Input type="number" value={form.berat_min} onChange={(e) => set("berat_min", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Berat Max (kg)</Label>
            <Input type="number" value={form.berat_max} onChange={(e) => set("berat_max", e.target.value)} />
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label>Keterangan</Label>
        <Input value={form.keterangan} onChange={(e) => set("keterangan", e.target.value)} placeholder="Opsional" />
      </div>
      <Button
        className="w-full"
        onClick={() =>
          onSave({
            nama_kategori: form.nama_kategori,
            kelompok_umur: form.kelompok_umur,
            jenis_kelamin: form.jenis_kelamin,
            berat_min: form.berat_min ? Number(form.berat_min) : null,
            berat_max: form.berat_max ? Number(form.berat_max) : null,
            keterangan: form.keterangan || null,
          })
        }
      >
        {initial ? "Simpan Perubahan" : "Tambah Kategori"}
      </Button>
    </div>
  );
}
