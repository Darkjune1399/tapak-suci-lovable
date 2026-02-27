import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Shuffle, CalendarClock, FileText } from "lucide-react";
import { BracketView } from "@/components/competition/BracketView";
import { generateBracket, getRoundCount, type BracketParticipant } from "@/lib/bracket-algorithm";
import { generateCompetitionReport } from "@/lib/competition-report";


interface MasterCategory {
  id: string;
  nama_kategori: string;
  kelompok_umur: string;
  jenis_kelamin: string;
  berat_min: number | null;
  berat_max: number | null;
  keterangan: string | null;
}

interface Competition {
  id: string;
  nama_kompetisi: string;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
  lokasi: string;
  jumlah_gelanggang: number;
  waktu_per_pertandingan: number;
  status: string;
  catatan: string | null;
}

interface Category {
  id: string;
  competition_id: string;
  nama_kategori: string;
  kelompok_umur: string;
  jenis_kelamin: string;
  berat_min: number | null;
  berat_max: number | null;
  keterangan: string | null;
  participant_count?: number;
}

interface Participant {
  id: string;
  category_id: string;
  member_id: string;
  berat_badan: number | null;
  seed_number: number | null;
  member_name: string;
  cabang: string | null;
  unit_latihan: string | null;
}

interface Match {
  id: string;
  category_id: string;
  round: number;
  match_number: number;
  participant1_id: string | null;
  participant2_id: string | null;
  winner_id: string | null;
  gelanggang: number | null;
  waktu_mulai: string | null;
  nomor_partai: number | null;
  status: string;
}

export default function CompetitionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { toast } = useToast();

  const [comp, setComp] = useState<Competition | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [members, setMembers] = useState<{ id: string; nama_lengkap: string; cabang: string | null; unit_latihan: string | null }[]>([]);
  const [masterCategories, setMasterCategories] = useState<MasterCategory[]>([]);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = role === "super_admin" || role === "komite";

  const fetchComp = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("competitions").select("*").eq("id", id).single();
    setComp(data);
  }, [id]);

  const fetchCategories = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("competition_categories")
      .select("*")
      .eq("competition_id", id)
      .order("nama_kategori");

    if (!data) { setCategories([]); setLoading(false); return; }

    // Count participants per category
    const catIds = data.map((c: any) => c.id);
    const { data: parts } = await supabase
      .from("competition_participants")
      .select("category_id")
      .in("category_id", catIds.length > 0 ? catIds : ["none"]);

    const countMap: Record<string, number> = {};
    parts?.forEach((p: any) => { countMap[p.category_id] = (countMap[p.category_id] || 0) + 1; });

    setCategories(data.map((c: any) => ({ ...c, participant_count: countMap[c.id] || 0 })));
    setLoading(false);
  }, [id]);

  const fetchParticipants = useCallback(async () => {
    if (!selectedCat) { setParticipants([]); return; }
    const { data } = await supabase
      .from("competition_participants")
      .select("*")
      .eq("category_id", selectedCat);

    if (!data || data.length === 0) { setParticipants([]); return; }

    const memberIds = data.map((p: any) => p.member_id);
    const { data: membersData } = await supabase
      .from("members")
      .select("id, nama_lengkap, cabang, unit_latihan")
      .in("id", memberIds);

    const memberMap = new Map<string, any>();
    membersData?.forEach((m: any) => memberMap.set(m.id, m));

    setParticipants(
      data.map((p: any) => {
        const m = memberMap.get(p.member_id);
        return {
          ...p,
          member_name: m?.nama_lengkap || "?",
          cabang: m?.cabang || null,
          unit_latihan: m?.unit_latihan || null,
        };
      })
    );
  }, [selectedCat]);

  const fetchMatches = useCallback(async () => {
    if (!selectedCat) { setMatches([]); return; }
    const { data } = await supabase
      .from("competition_matches")
      .select("*")
      .eq("category_id", selectedCat)
      .order("round")
      .order("match_number");
    setMatches(data || []);
  }, [selectedCat]);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from("members")
      .select("id, nama_lengkap, cabang, unit_latihan")
      .eq("status_aktif", true)
      .order("nama_lengkap");
    setMembers(data || []);
  };

  const fetchMasterCategories = async () => {
    const { data } = await supabase
      .from("master_competition_categories")
      .select("*")
      .order("nama_kategori")
      .order("kelompok_umur");
    setMasterCategories((data as MasterCategory[]) || []);
  };

  useEffect(() => { fetchComp(); fetchCategories(); fetchMembers(); fetchMasterCategories(); }, [fetchComp, fetchCategories]);
  useEffect(() => { fetchParticipants(); fetchMatches(); }, [fetchParticipants, fetchMatches]);

  // --- Category CRUD ---
  const handleAddCategory = async (cat: Omit<Category, "id" | "competition_id" | "participant_count">) => {
    const { error } = await supabase.from("competition_categories").insert({
      competition_id: id!,
      nama_kategori: cat.nama_kategori,
      kelompok_umur: cat.kelompok_umur,
      jenis_kelamin: cat.jenis_kelamin,
      berat_min: cat.berat_min,
      berat_max: cat.berat_max,
      keterangan: cat.keterangan,
    });
    if (error) {
      toast({ title: "Gagal menambah kategori", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Kategori ditambahkan" });
      setAddCatOpen(false);
      fetchCategories();
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    const { error } = await supabase.from("competition_categories").delete().eq("id", catId);
    if (error) toast({ title: "Gagal", description: error.message, variant: "destructive" });
    else {
      if (selectedCat === catId) setSelectedCat(null);
      fetchCategories();
    }
  };

  // --- Participant CRUD ---
  const handleAddParticipant = async (memberId: string, beratBadan: number | null, seedNumber: number | null) => {
    const { error } = await supabase.from("competition_participants").insert({
      category_id: selectedCat!,
      member_id: memberId,
      berat_badan: beratBadan,
      seed_number: seedNumber,
    });
    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Peserta ditambahkan" });
      setAddPartOpen(false);
      fetchParticipants();
      fetchCategories();
    }
  };

  const handleRemoveParticipant = async (partId: string) => {
    await supabase.from("competition_participants").delete().eq("id", partId);
    fetchParticipants();
    fetchCategories();
  };

  // --- Bracket Generation ---
  const handleGenerateBracket = async () => {
    if (!selectedCat || participants.length < 2) {
      toast({ title: "Minimal 2 peserta untuk generate bracket", variant: "destructive" });
      return;
    }

    // Delete existing matches for this category
    await supabase.from("competition_matches").delete().eq("category_id", selectedCat);

    const bracketParticipants: BracketParticipant[] = participants.map((p) => ({
      id: p.id,
      member_id: p.member_id,
      member_name: p.member_name,
      cabang: p.cabang,
      unit_latihan: p.unit_latihan,
      seed_number: p.seed_number,
    }));

    const bracketMatches = generateBracket(bracketParticipants);

    // Insert matches
    const inserts = bracketMatches.map((m) => ({
      category_id: selectedCat!,
      round: m.round,
      match_number: m.match_number,
      participant1_id: m.participant1_id,
      participant2_id: m.participant2_id,
      winner_id: m.winner_id || null,
      status: m.status,
    }));

    const { error } = await supabase
      .from("competition_matches")
      .insert(inserts)
      .select();

    if (error) {
      toast({ title: "Gagal generate bracket", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bracket berhasil di-generate!" });
      fetchMatches();
    }
  };

  // --- Auto Schedule ---
  const handleAutoSchedule = async () => {
    if (!comp || matches.length === 0) return;

    const gelanggang = comp.jumlah_gelanggang;
    const durasi = comp.waktu_per_pertandingan;

    // Only schedule non-bye first-round matches initially, then later rounds
    const sortedMatches = [...matches].sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.match_number - b.match_number;
    });

    const startTime = new Date(`${comp.tanggal_mulai}T08:00:00`);
    let partaiNum = 1;

    const updates: { id: string; nomor_partai: number; gelanggang: number; waktu_mulai: string }[] = [];

    for (const match of sortedMatches) {
      if (match.status === "bye") continue;
      const gIdx = (updates.length % gelanggang) + 1;
      const timeSlot = Math.floor(updates.length / gelanggang);
      const waktu = new Date(startTime.getTime() + timeSlot * durasi * 60000);

      updates.push({
        id: match.id,
        nomor_partai: partaiNum++,
        gelanggang: gIdx,
        waktu_mulai: waktu.toISOString(),
      });
    }

    for (const u of updates) {
      await supabase
        .from("competition_matches")
        .update({ nomor_partai: u.nomor_partai, gelanggang: u.gelanggang, waktu_mulai: u.waktu_mulai })
        .eq("id", u.id);
    }

    toast({ title: "Jadwal otomatis berhasil dibuat" });
    fetchMatches();
  };

  // --- Set Winner ---
  const handleSetWinner = async (matchId: string, winnerId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    const isByeMatch = match.status === "bye";

    const { error } = await supabase
      .from("competition_matches")
      .update({ winner_id: winnerId, status: "completed" })
      .eq("id", matchId);

    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
      return;
    }

    // Advance winner to next round
    const totalRounds = getRoundCount(participants.length);
    if (match.round < totalRounds) {
      const nextRound = match.round + 1;
      const nextMatchNumber = Math.ceil(match.match_number / 2);
      const isTopSlot = match.match_number % 2 === 1;

      const nextMatch = matches.find(
        (m) => m.round === nextRound && m.match_number === nextMatchNumber
      );

      if (nextMatch) {
        const field = isTopSlot ? "participant1_id" : "participant2_id";
        const otherField = isTopSlot ? "participant2_id" : "participant1_id";

        // Place winner in slot
        await supabase.from("competition_matches").update({ [field]: winnerId }).eq("id", nextMatch.id);

        // Check if the opponent slot is empty (making it a BYE match for next round)
        const opponentId = (nextMatch as any)[otherField];
        if (!opponentId) {
          // Mark as BYE so user can click to advance
          await supabase.from("competition_matches").update({ [field]: winnerId, status: "bye" }).eq("id", nextMatch.id);
        }
      }
    }

    toast({ title: isByeMatch ? "Peserta dimajukan ke babak selanjutnya" : "Pemenang ditetapkan" });
    fetchMatches();
  };

  const existingMemberIds = new Set(participants.map((p) => p.member_id));
  const availableMembers = members.filter((m) => !existingMemberIds.has(m.id));
  const totalRounds = participants.length >= 2 ? getRoundCount(participants.length) : 0;

  // --- Generate Report ---
  const handleGenerateReport = async () => {
    if (!comp) return;
    // Fetch all participants and matches across all categories
    const catIds = categories.map((c) => c.id);
    if (catIds.length === 0) {
      toast({ title: "Tidak ada kategori untuk laporan", variant: "destructive" });
      return;
    }

    const [{ data: allParts }, { data: allMatches }] = await Promise.all([
      supabase.from("competition_participants").select("*").in("category_id", catIds),
      supabase.from("competition_matches").select("*").in("category_id", catIds),
    ]);

    // Get member names
    const memberIds = [...new Set((allParts || []).map((p: any) => p.member_id))];
    const { data: membersData } = await supabase
      .from("members")
      .select("id, nama_lengkap, cabang, unit_latihan")
      .in("id", memberIds.length > 0 ? memberIds : ["none"]);

    const memberMap = new Map<string, any>();
    membersData?.forEach((m: any) => memberMap.set(m.id, m));

    const participantsByCategory: Record<string, any[]> = {};
    const matchesByCategory: Record<string, any[]> = {};

    for (const cat of categories) {
      participantsByCategory[cat.id] = (allParts || [])
        .filter((p: any) => p.category_id === cat.id)
        .map((p: any) => {
          const m = memberMap.get(p.member_id);
          return {
            id: p.id,
            member_name: m?.nama_lengkap || "?",
            cabang: m?.cabang || null,
            unit_latihan: m?.unit_latihan || null,
            seed_number: p.seed_number,
            category_id: p.category_id,
          };
        });

      matchesByCategory[cat.id] = (allMatches || []).filter((m: any) => m.category_id === cat.id);
    }

    generateCompetitionReport(comp, categories, participantsByCategory, matchesByCategory);
    toast({ title: "Laporan berhasil di-download" });
  };

  if (!comp && !loading) {
    return <AppLayout><div className="text-center py-12 text-muted-foreground">Kompetisi tidak ditemukan</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/kompetisi")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{comp?.nama_kompetisi || "..."}</h1>
            <p className="text-sm text-muted-foreground">
              {comp && `${new Date(comp.tanggal_mulai).toLocaleDateString("id-ID")} • ${comp.lokasi} • ${comp.jumlah_gelanggang} gelanggang`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleGenerateReport} disabled={categories.length === 0}>
            <FileText className="mr-2 h-4 w-4" />Laporan PDF
          </Button>
        </div>

        {/* Categories List */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Kategori ({categories.length})</h2>
          {canEdit && comp?.status !== "selesai" && (
            <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Tambah Kategori</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Tambah Kategori</DialogTitle></DialogHeader>
                <CategoryForm masterCategories={masterCategories} onAdd={handleAddCategory} />
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <Card
              key={cat.id}
              className={`cursor-pointer transition-colors ${selectedCat === cat.id ? "ring-2 ring-primary" : "hover:bg-muted/50"}`}
              onClick={() => setSelectedCat(cat.id)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{cat.nama_kategori}</p>
                    <p className="text-xs text-muted-foreground">
                      {cat.kelompok_umur} • {cat.jenis_kelamin === "putra" ? "Putra" : "Putri"}
                      {cat.berat_min != null && cat.berat_max != null && ` • ${cat.berat_min}-${cat.berat_max} kg`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{cat.participant_count || 0} peserta</p>
                  </div>
                  {canEdit && (
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {categories.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-8">Belum ada kategori</p>
          )}
        </div>

        {/* Selected Category Detail */}
        {selectedCat && (
          <Tabs defaultValue="peserta" className="mt-4">
            <TabsList>
              <TabsTrigger value="peserta">Peserta</TabsTrigger>
              <TabsTrigger value="bracket">Bracket</TabsTrigger>
            </TabsList>

            <TabsContent value="peserta">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Peserta</h3>
                  {canEdit && (
                    <Dialog open={addPartOpen} onOpenChange={setAddPartOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm"><Plus className="mr-2 h-4 w-4" />Tambah Peserta</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>Tambah Peserta</DialogTitle></DialogHeader>
                        <ParticipantForm members={availableMembers} onAdd={handleAddParticipant} />
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama</TableHead>
                          <TableHead>Cabang/Unit</TableHead>
                          <TableHead>Berat (kg)</TableHead>
                          <TableHead>Seed</TableHead>
                          {canEdit && <TableHead className="w-16">Aksi</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {participants.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada peserta</TableCell></TableRow>
                        ) : (
                          participants.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.member_name}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">{p.cabang || "-"} / {p.unit_latihan || "-"}</TableCell>
                              <TableCell>{p.berat_badan ?? "-"}</TableCell>
                              <TableCell>{p.seed_number ? <Badge variant="secondary">#{p.seed_number}</Badge> : "-"}</TableCell>
                              {canEdit && (
                                <TableCell>
                                  <Button size="icon" variant="ghost" onClick={() => handleRemoveParticipant(p.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
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
            </TabsContent>

            <TabsContent value="bracket">
              <div className="space-y-3">
                {canEdit && (
                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={participants.length < 2}>
                          <Shuffle className="mr-2 h-4 w-4" />Generate Bracket
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Generate Bracket?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {matches.length > 0
                              ? "Bracket yang sudah ada akan dihapus dan di-generate ulang. Data pertandingan sebelumnya akan hilang. Lanjutkan?"
                              : "Bracket akan di-generate berdasarkan peserta yang terdaftar. Lanjutkan?"}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={handleGenerateBracket}>Ya, Generate</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={matches.length === 0}>
                          <CalendarClock className="mr-2 h-4 w-4" />Auto Jadwal
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Auto Penjadwalan?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Jadwal pertandingan akan di-generate ulang secara otomatis. Jadwal sebelumnya akan ditimpa. Lanjutkan?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={handleAutoSchedule}>Ya, Jadwalkan</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}

                <Card>
                  <CardContent className="p-4">
                    <BracketView
                      matches={matches}
                      participants={participants.map((p) => ({ id: p.id, member_name: p.member_name }))}
                      totalRounds={totalRounds}
                      onSelectWinner={canEdit ? handleSetWinner : undefined}
                      canEdit={canEdit}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

// --- Sub-forms ---

function CategoryForm({ masterCategories, onAdd }: { masterCategories: MasterCategory[]; onAdd: (cat: any) => void }) {
  const [selectedId, setSelectedId] = useState("");

  const selected = masterCategories.find((c) => c.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Pilih Kategori dari Master *</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger><SelectValue placeholder="Pilih kategori..." /></SelectTrigger>
          <SelectContent>
            {masterCategories.length === 0 ? (
              <SelectItem value="__empty" disabled>Belum ada kategori master</SelectItem>
            ) : (
              masterCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nama_kategori} - {c.kelompok_umur} ({c.jenis_kelamin === "putra" ? "Pa" : "Pi"})
                  {c.berat_min != null && c.berat_max != null ? ` ${c.berat_min}-${c.berat_max}kg` : ""}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      {selected && (
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md space-y-1">
          <p><strong>Kategori:</strong> {selected.nama_kategori}</p>
          <p><strong>Umur:</strong> {selected.kelompok_umur}</p>
          <p><strong>Gender:</strong> {selected.jenis_kelamin === "putra" ? "Putra" : "Putri"}</p>
          {selected.berat_min != null && <p><strong>Berat:</strong> {selected.berat_min} - {selected.berat_max} kg</p>}
          {selected.keterangan && <p><strong>Keterangan:</strong> {selected.keterangan}</p>}
        </div>
      )}
      <Button
        className="w-full"
        disabled={!selected}
        onClick={() => {
          if (!selected) return;
          onAdd({
            nama_kategori: selected.nama_kategori,
            kelompok_umur: selected.kelompok_umur,
            jenis_kelamin: selected.jenis_kelamin,
            berat_min: selected.berat_min,
            berat_max: selected.berat_max,
            keterangan: selected.keterangan,
          });
        }}
      >
        Tambah Kategori
      </Button>
    </div>
  );
}

function ParticipantForm({
  members,
  onAdd,
}: {
  members: { id: string; nama_lengkap: string }[];
  onAdd: (memberId: string, berat: number | null, seed: number | null) => void;
}) {
  const [memberId, setMemberId] = useState("");
  const [berat, setBerat] = useState("");
  const [seed, setSeed] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Anggota *</Label>
        <Select value={memberId} onValueChange={setMemberId}>
          <SelectTrigger><SelectValue placeholder="Pilih anggota" /></SelectTrigger>
          <SelectContent>
            {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.nama_lengkap}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Berat Badan (kg)</Label>
          <Input type="number" value={berat} onChange={(e) => setBerat(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Seed (opsional)</Label>
          <Input type="number" min={1} value={seed} onChange={(e) => setSeed(e.target.value)} />
        </div>
      </div>
      <Button
        className="w-full"
        disabled={!memberId}
        onClick={() => onAdd(memberId, berat ? Number(berat) : null, seed ? Number(seed) : null)}
      >
        Tambah Peserta
      </Button>
    </div>
  );
}
