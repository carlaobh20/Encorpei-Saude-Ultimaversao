/**
 * Formulário de feedback — compartilhado entre a tela do paciente (/feedback)
 * e a do médico (/pro/feedback). Categoria, tela, descrição (até 1000),
 * importância e anexo opcional (print/arquivo). Redesenho 31/08/2026 seguindo
 * a referência do Dr. Carlos; a lógica de envio (useSubmitFeedback) e o
 * contrato do banco NÃO mudaram — só a apresentação.
 */
import { useRef, useState } from "react";
import { Lightbulb, Bug, Star, TrendingUp, Loader2, CheckCircle2, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSubmitFeedback, type FeedbackCategory, type FeedbackImportance } from "@/hooks/useFeedback";

const MAX_CHARS = 1000;
const MAX_ATTACHMENT_MB = 20;
const ACCEPTED_TYPES = "image/png,image/jpeg,image/jpg,application/pdf";

interface FeedbackFormProps {
  role: "patient" | "professional";
  authorName: string | null;
  screens: string[];
}

export function FeedbackForm({ role, authorName, screens }: FeedbackFormProps) {
  const isPatient = role === "patient";
  const { toast } = useToast();
  const submit = useSubmitFeedback();
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [screen, setScreen] = useState<string>("");
  const [message, setMessage] = useState("");
  const [importance, setImportance] = useState<FeedbackImportance>("nice_to_have");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sent, setSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CATEGORIES: { value: FeedbackCategory; label: string; desc: string; icon: typeof Lightbulb; iconTone: string; placeholder: string }[] = [
    { value: "suggestion", label: "Sugestão", desc: "Tenho uma ideia para melhorar", icon: Lightbulb, iconTone: "bg-warning-bg text-warning", placeholder: "Qual é a sua sugestão? O que você gostaria de ver no app?" },
    { value: "bug", label: "Reportar erro", desc: "Algo não funcionou como esperado", icon: Bug, iconTone: "bg-error-bg text-error", placeholder: "O que aconteceu? O que você esperava que acontecesse? Se puder, anexe um print abaixo." },
    { value: "praise", label: "Elogio", desc: isPatient ? "Quero contar o que gostei" : "Quero destacar algo que gostei", icon: Star, iconTone: "bg-warning-bg text-warning", placeholder: "O que você gostou? Conte pra gente." },
    { value: "improvement", label: "Melhoria", desc: isPatient ? "Pode ficar ainda melhor" : "Funciona, mas poderia ser melhor", icon: TrendingUp, iconTone: "bg-accompany-bg text-accompany", placeholder: "O que já funciona bem, mas poderia melhorar?" },
  ];

  const IMPORTANCE: { value: FeedbackImportance; label: string; emoji: string; desc: string }[] = [
    { value: "nice_to_have", label: "Legal ter", emoji: "😊", desc: isPatient ? "Não é urgente" : "Não é urgente, mas seria legal" },
    { value: "important", label: "Importante", emoji: "🔶", desc: "Melhora a experiência" },
    { value: "essential", label: "Essencial", emoji: "🔥", desc: isPatient ? "Impacta minha saúde" : "Impacta meu trabalho" },
  ];

  const canSubmit = !!category && message.trim().length >= 5;
  const selectedCategory = CATEGORIES.find((c) => c.value === category);

  const takeFile = (file: File | undefined | null) => {
    if (!file) return;
    const okType = /^image\/(png|jpe?g)$/.test(file.type) || file.type === "application/pdf";
    if (!okType) { toast({ title: "Formato não aceito", description: "Envie PNG, JPG ou PDF.", variant: "destructive" }); return; }
    if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) { toast({ title: `Arquivo muito grande (máximo ${MAX_ATTACHMENT_MB}MB)`, variant: "destructive" }); return; }
    setAttachment(file);
  };

  const handleSubmit = async () => {
    if (!category) { toast({ title: "Escolha uma categoria", variant: "destructive" }); return; }
    if (message.trim().length < 5) { toast({ title: "Conte um pouco mais sobre isso", variant: "destructive" }); return; }
    try {
      await submit.mutateAsync({ authorRole: role, authorName, category, screen: screen || undefined, message, importance, attachment });
      setSent(true);
    } catch (e: any) {
      toast({ title: "Não foi possível enviar", description: e.message, variant: "destructive" });
    }
  };

  if (sent) {
    return (
      <div className="rounded-3xl bg-card border border-border shadow-sm p-8 text-center space-y-3">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-success-bg text-success mx-auto">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="font-display text-xl font-medium text-foreground">Feedback enviado com sucesso!</h2>
        <p className="text-sm text-muted-foreground">
          {isPatient ? "Obrigado por nos ajudar a cuidar melhor da sua saúde. ❤️" : "Obrigado por ajudar a melhorar o Encorpei — sua mensagem chegou até a nossa equipe."}
        </p>
        <Button variant="outline" onClick={() => { setSent(false); setCategory(null); setScreen(""); setMessage(""); setImportance("nice_to_have"); setAttachment(null); }}>
          Enviar outro feedback
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Categorias */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              aria-pressed={active}
              className={cn(
                "rounded-2xl border bg-card p-4 text-left transition-all",
                active ? "border-primary ring-1 ring-primary/30 shadow-sm" : "border-border hover:border-border-strong shadow-xs",
              )}
            >
              <div className={cn("h-10 w-10 rounded-xl grid place-items-center mb-2.5", c.iconTone)}>
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <p className="text-sm font-semibold text-foreground">{c.label}</p>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug">{c.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Formulário */}
      <div className="rounded-3xl bg-card border border-border shadow-sm p-5 md:p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Qual tela ou funcionalidade? <span className="text-muted-foreground font-normal">(opcional)</span></label>
          <Select value={screen} onValueChange={setScreen}>
            <SelectTrigger className="h-11 rounded-2xl"><SelectValue placeholder="Selecione uma opção" /></SelectTrigger>
            <SelectContent>{screens.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Conte mais sobre isso</label>
          <p className="text-xs text-muted-foreground -mt-0.5">O que aconteceu? O que você esperava que acontecesse?</p>
          <div className="relative">
            <Textarea
              placeholder={selectedCategory?.placeholder ?? "Escreva aqui em detalhes…"}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
              maxLength={MAX_CHARS}
              rows={5}
              className="rounded-2xl resize-none pb-7"
            />
            <span className="absolute bottom-2.5 right-3 text-[11px] text-muted-foreground tabular-nums">{message.length}/{MAX_CHARS}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            {category === "bug" ? "Print da tela " : "Anexar um arquivo? "}<span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} onChange={(e) => { takeFile(e.target.files?.[0]); e.target.value = ""; }} className="hidden" />
          {attachment ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
              <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-[12.5px] text-foreground truncate flex-1">{attachment.name}</span>
              <span className="text-[11px] text-muted-foreground shrink-0">{(attachment.size / 1024 / 1024).toFixed(1)} MB</span>
              <button type="button" onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Remover anexo">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); takeFile(e.dataTransfer.files?.[0]); }}
              className={cn("w-full flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed py-5 transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-border-strong")}
            >
              <span className="inline-flex items-center gap-2 text-[12.5px] text-foreground"><Paperclip className="h-4 w-4" /> {isPatient ? "Toque para anexar" : "Arraste e solte ou clique para anexar"}</span>
              <span className="text-[11px] text-muted-foreground">PNG, JPG ou PDF — até {MAX_ATTACHMENT_MB}MB</span>
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Quão importante é isso para você?</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {IMPORTANCE.map((i) => {
              const active = importance === i.value;
              return (
                <button key={i.value} type="button" onClick={() => setImportance(i.value)} aria-pressed={active}
                  className={cn("rounded-2xl border p-3 text-left transition-all", active ? "border-primary ring-1 ring-primary/30 bg-cardio-50" : "border-border bg-card hover:border-border-strong")}>
                  <div className={cn("text-sm font-semibold flex items-center gap-1.5", active ? "text-primary" : "text-foreground")}><span aria-hidden>{i.emoji}</span> {i.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{i.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <Button className="w-full" size="lg" disabled={!canSubmit || submit.isPending} onClick={handleSubmit}>
          {submit.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando…</> : "Enviar feedback"}
        </Button>

        <p className="text-[11px] text-muted-foreground text-center">
          {isPatient ? "Obrigado por nos ajudar a cuidar melhor da sua saúde. 💛" : "Seu feedback é muito importante e será analisado com carinho pela nossa equipe."}
        </p>
      </div>
    </div>
  );
}
