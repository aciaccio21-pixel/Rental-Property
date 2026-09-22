"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarSync } from "./calendar-sync";
import { CleanerSchedule } from "./cleaner-schedule";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileCheck2,
  Home,
  Loader2,
  LogOut,
  Plus,
  PencilLine,
  Printer,
  ReceiptText,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";

type Property = {
  id: string;
  name: string;
  groupName: string;
  rentalType: "long_term" | "short_term" | "mixed";
  address: string;
  tenantName: string;
  monthlyRent: number;
  estimatedMonthlyCosts: number;
  active: number | boolean;
  isDemo: number | boolean;
};

type Transaction = {
  id: string;
  propertyId: string;
  kind: "income" | "expense";
  amount: number;
  date: string;
  category: string;
  counterparty: string;
  paymentMethod: string;
  notes: string;
  taxTreatment: "income" | "deductible" | "non_deductible" | "review";
  receiptOnFile: number | boolean;
  isDemo: number | boolean;
};

type Occupancy = {
  id: string;
  propertyId: string;
  month: string;
  availableNights: number;
  bookedNights: number;
  revenue: number;
  isDemo: number | boolean;
};

type MonthlyClose = {
  id: string;
  month: string;
  status: string;
  notes: string;
  closedAt: string | null;
};

type PortfolioData = {
  starterData: boolean;
  properties: Property[];
  transactions: Transaction[];
  occupancy: Occupancy[];
  closes: MonthlyClose[];
};

const emptyData: PortfolioData = {
  starterData: false,
  properties: [],
  transactions: [],
  occupancy: [],
  closes: [],
};

const expenseCategories = [
  "Advertising",
  "Bank & admin fees",
  "Cleaning",
  "HOA",
  "Insurance",
  "Landscaping",
  "Legal & professional",
  "Mortgage interest",
  "Mortgage principal",
  "Platform fees",
  "Property taxes",
  "Repairs & maintenance",
  "Supplies",
  "Travel & mileage",
  "Utilities",
  "Other",
];

const incomeCategories = ["Rent", "Airbnb / Vrbo", "Direct booking", "Late fee", "Other income"];

const navItems = [
  { value: "overview", label: "Overview", icon: Home },
  { value: "transactions", label: "Transactions", icon: ReceiptText },
  { value: "occupancy", label: "Occupancy", icon: CalendarDays },
  { value: "reports", label: "Reports", icon: FileCheck2 },
  { value: "properties", label: "Properties", icon: Building2 },
] as const;

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function money(value: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

function monthLabel(value: string, short = false) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function lastMonths(count: number) {
  const result: string[] = [];
  const date = new Date();
  date.setDate(1);
  for (let i = count - 1; i >= 0; i -= 1) {
    const copy = new Date(date);
    copy.setMonth(copy.getMonth() - i);
    result.push(`${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

function quarterMonths(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = Math.floor((monthNumber - 1) / 3) * 3 + 1;
  return [0, 1, 2].map(
    (offset) => `${year}-${String(start + offset).padStart(2, "0")}`
  );
}

function propertyName(properties: Property[], id: string) {
  return properties.find((property) => property.id === id)?.name ?? "Unknown property";
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "navy",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof WalletCards;
  tone?: "navy" | "gold" | "green" | "slate";
}) {
  const colors = {
    navy: "bg-[#e9f0f5] text-[#173f5f]",
    gold: "bg-[#fff3d6] text-[#8a6112]",
    green: "bg-[#e6f2ee] text-[#2f7d69]",
    slate: "bg-[#edf0f3] text-[#536170]",
  };
  return (
    <section data-print-card className="rounded-2xl border bg-card p-5 shadow-[0_8px_24px_rgba(23,63,95,.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-[-.035em] text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${colors[tone]}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </section>
  );
}

export function RentalDashboard({ displayName }: { displayName: string }) {
  const [data, setData] = useState<PortfolioData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [propertySaveError, setPropertySaveError] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [propertyDetailsOpen, setPropertyDetailsOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<"month" | "quarter">("month");
  const [transactionKind, setTransactionKind] = useState<"income" | "expense">("income");

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch("/api/portfolio", { cache: "no-store", signal: AbortSignal.timeout(30000) });
      const result = (await response.json()) as PortfolioData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load the portfolio.");
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the portfolio.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data.properties.length) {
      if (selectedPropertyId) setSelectedPropertyId("");
      return;
    }
    if (!data.properties.some((property) => property.id === selectedPropertyId)) {
      setSelectedPropertyId(data.properties[0].id);
    }
  }, [data.properties, selectedPropertyId]);

  const mutate = useCallback(async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
      const result = (await response.json()) as PortfolioData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save the change.");
      setData(result);
      return result;
    } catch (saveError) {
      const message = saveError instanceof Error && (saveError.name === "TimeoutError" || saveError.name === "AbortError")
        ? "The server took too long to respond. Your entries are still here. Check the property list before retrying, as the save may have completed."
        : saveError instanceof Error ? saveError.message : "Could not save the change.";
      toast.error(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, []);

  const monthTransactions = useMemo(
    () =>
      data.transactions.filter(
        (transaction) =>
          transaction.date.startsWith(selectedMonth) &&
          (propertyFilter === "all" || transaction.propertyId === propertyFilter)
      ),
    [data.transactions, propertyFilter, selectedMonth]
  );

  const monthOccupancy = useMemo(
    () =>
      data.occupancy.filter(
        (row) =>
          row.month === selectedMonth &&
          (propertyFilter === "all" || row.propertyId === propertyFilter)
      ),
    [data.occupancy, propertyFilter, selectedMonth]
  );

  const totals = useMemo(() => {
    const income = monthTransactions
      .filter((item) => item.kind === "income")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = monthTransactions
      .filter((item) => item.kind === "expense")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const available = monthOccupancy.reduce((sum, item) => sum + item.availableNights, 0);
    const booked = monthOccupancy.reduce((sum, item) => sum + item.bookedNights, 0);
    return {
      income,
      expenses,
      net: income - expenses,
      occupancy: available ? Math.round((booked / available) * 100) : 0,
      vacantNights: Math.max(0, available - booked),
    };
  }, [monthOccupancy, monthTransactions]);

  const shortTermProperties = data.properties.filter(
    (property) => property.rentalType === "short_term" || property.rentalType === "mixed"
  );
  const selectedProperty = data.properties.find(
    (property) => property.id === selectedPropertyId
  );
  const selectedPropertyMonthTransactions = data.transactions.filter(
    (item) =>
      item.propertyId === selectedPropertyId && item.date.startsWith(selectedMonth)
  );
  const selectedPropertyActualIncome = selectedPropertyMonthTransactions
    .filter((item) => item.kind === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const selectedPropertyActualExpenses = selectedPropertyMonthTransactions
    .filter((item) => item.kind === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const expensesThisMonth = monthTransactions.filter((item) => item.kind === "expense");
  const missingReceipts = expensesThisMonth.filter(
    (item) => item.taxTreatment !== "non_deductible" && !Boolean(item.receiptOnFile)
  ).length;
  const needsTaxReview = expensesThisMonth.filter((item) => item.taxTreatment === "review").length;
  const occupancyComplete =
    shortTermProperties.length === 0 ||
    shortTermProperties.every((property) =>
      data.occupancy.some(
        (row) => row.month === selectedMonth && row.propertyId === property.id
      )
    );
  const isClosed = data.closes.some(
    (close) => close.month === selectedMonth && close.status === "closed"
  );
  const closeChecks = [
    { label: "Income and rent entered", done: monthTransactions.some((item) => item.kind === "income") },
    { label: "Expenses categorized", done: needsTaxReview === 0 && expensesThisMonth.length > 0 },
    { label: "Receipts accounted for", done: missingReceipts === 0 && expensesThisMonth.length > 0 },
    { label: "Short-term occupancy entered", done: occupancyComplete },
    { label: "Month reviewed and closed", done: isClosed },
  ];
  const closeProgress = Math.round(
    (closeChecks.filter((check) => check.done).length / closeChecks.length) * 100
  );

  const chartData = lastMonths(6).map((month) => {
    const rows = data.transactions.filter(
      (item) =>
        item.date.startsWith(month) &&
        (propertyFilter === "all" || item.propertyId === propertyFilter)
    );
    const income = rows
      .filter((item) => item.kind === "income")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = rows
      .filter((item) => item.kind === "expense")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    return { month: monthLabel(month, true), income, expenses, net: income - expenses };
  });

  const reportMonths = reportPeriod === "month" ? [selectedMonth] : quarterMonths(selectedMonth);
  const reportTransactions = data.transactions.filter(
    (item) =>
      reportMonths.some((month) => item.date.startsWith(month)) &&
      (propertyFilter === "all" || item.propertyId === propertyFilter)
  );
  const reportIncome = reportTransactions
    .filter((item) => item.kind === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const reportExpenses = reportTransactions
    .filter((item) => item.kind === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const reportDeductible = reportTransactions
    .filter((item) => item.kind === "expense" && item.taxTreatment === "deductible")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const taxBreakdown = Object.entries(
    reportTransactions
      .filter((item) => item.kind === "expense" && item.taxTreatment === "deductible")
      .reduce<Record<string, number>>((result, item) => {
        result[item.category] = (result[item.category] || 0) + Number(item.amount);
        return result;
      }, {})
  ).sort((a, b) => b[1] - a[1]);

  const recentTransactions = monthTransactions.slice(0, 8);
  const monthOptions = lastMonths(18).reverse();

  function exportCsv() {
    const headers = [
      "Date",
      "Property",
      "Type",
      "Category",
      "Counterparty",
      "Amount",
      "Tax treatment",
      "Receipt on file",
      "Payment method",
      "Notes",
    ];
    const rows = reportTransactions.map((item) => [
      item.date,
      propertyName(data.properties, item.propertyId),
      item.kind,
      item.category,
      item.counterparty,
      item.amount.toFixed(2),
      item.taxTreatment,
      Boolean(item.receiptOnFile) ? "Yes" : "No",
      item.paymentMethod,
      item.notes,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rental-steward-${reportPeriod}-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  }

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate({
      action: "create_transaction",
      kind: transactionKind,
      propertyId: form.get("propertyId"),
      amount: form.get("amount"),
      date: form.get("date"),
      category: form.get("category"),
      counterparty: form.get("counterparty"),
      paymentMethod: form.get("paymentMethod"),
      taxTreatment: form.get("taxTreatment"),
      receiptOnFile: form.get("receiptOnFile") === "on",
      notes: form.get("notes"),
    });
    setTransactionOpen(false);
    toast.success(transactionKind === "income" ? "Income recorded" : "Expense recorded");
  }

  async function submitProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setPropertySaveError("");
    const form = new FormData(event.currentTarget);
    try {
      await mutate({
        action: "create_property",
        name: form.get("name"),
        groupName: form.get("groupName"),
        rentalType: form.get("rentalType"),
        address: form.get("address"),
        tenantName: form.get("tenantName"),
        monthlyRent: form.get("monthlyRent"),
        estimatedMonthlyCosts: form.get("estimatedMonthlyCosts"),
      });
      setPropertyOpen(false);
      toast.success("Property added");
    } catch (saveError) {
      setPropertySaveError(saveError instanceof Error ? saveError.message : "Could not save the property. Your entries are still here.");
    }
  }

  async function updateProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProperty) return;
    const form = new FormData(event.currentTarget);
    await mutate({
      action: "update_property",
      id: selectedProperty.id,
      name: form.get("name"),
      groupName: form.get("groupName"),
      rentalType: form.get("rentalType"),
      address: form.get("address"),
      tenantName: form.get("tenantName"),
      monthlyRent: form.get("monthlyRent"),
      estimatedMonthlyCosts: form.get("estimatedMonthlyCosts"),
    });
    setPropertyDetailsOpen(false);
    toast.success("Property details updated");
  }

  async function submitOccupancy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate({
      action: "upsert_occupancy",
      propertyId: form.get("propertyId"),
      month: form.get("month"),
      availableNights: form.get("availableNights"),
      bookedNights: form.get("bookedNights"),
      revenue: form.get("revenue"),
    });
    toast.success("Occupancy updated");
  }

  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool?: (tool: {
            name: string;
            title: string;
            description: string;
            inputSchema: object;
            annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
            execute: (input: unknown) => Promise<unknown>;
          }, options?: { signal?: AbortSignal }) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const register = context.registerTool.bind(context);
    void Promise.resolve(
      register(
        {
          name: "record_rental_transaction",
          title: "Record rental transaction",
          description: "Record one rental income or expense item and refresh the visible portfolio.",
          inputSchema: {
            type: "object",
            properties: {
              propertyId: { type: "string" },
              kind: { type: "string", enum: ["income", "expense"] },
              amount: { type: "number", exclusiveMinimum: 0 },
              date: { type: "string" },
              category: { type: "string" },
              counterparty: { type: "string" },
              taxTreatment: {
                type: "string",
                enum: ["income", "deductible", "non_deductible", "review"],
              },
            },
            required: ["propertyId", "kind", "amount", "date", "category"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            const value = input as Record<string, unknown>;
            const result = await mutate({ action: "create_transaction", ...value });
            return {
              saved: true,
              transactionCount: result.transactions.length,
            };
          },
        },
        { signal: controller.signal }
      )
    ).catch(() => undefined);
    return () => controller.abort();
  }, [mutate]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="flex items-center gap-3 text-[#173f5f]">
          <Loader2 className="size-5 animate-spin" />
          <span className="font-semibold">Opening your portfolio…</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto grid min-h-screen max-w-lg place-items-center px-6">
        <Alert variant="destructive">
          <AlertTitle>Rental Steward could not open</AlertTitle>
          <AlertDescription className="mt-2">{error}</AlertDescription>
          <Button className="mt-4" onClick={() => void load()}>Try again</Button>
        </Alert>
      </main>
    );
  }

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={setTab}
        orientation="vertical"
        className="min-h-screen flex-col gap-0 md:flex-row"
      >
        <aside data-no-print className="border-b bg-[#102f47] text-white md:fixed md:inset-y-0 md:left-0 md:w-64 md:border-b-0 md:border-r md:border-[#315672]">
          <div className="flex items-center justify-between px-5 py-5 md:block md:px-6 md:py-7">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[#f0b84b] text-[#173f5f]">
                <Building2 className="size-5" />
              </span>
              <div>
                <p className="text-lg font-bold tracking-[-.025em]">Rental Steward</p>
                <p className="text-sm font-medium text-white/80">Property Portfolio</p>
              </div>
            </div>
            <Badge className="hidden border-[#426a86] bg-[#1c4767] text-slate-100 md:mt-5 md:inline-flex">
              Private portfolio
            </Badge>
          </div>
          <TabsList
            variant="line"
            data-rental-navigation
            className="scrollbar-none flex w-full justify-start overflow-x-auto rounded-none border-t border-[#315672] bg-transparent px-3 py-2 md:h-auto md:flex-col md:items-stretch md:border-t-0 md:px-4 md:py-3"
          >
            {navItems.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="h-12 shrink-0 justify-start rounded-lg px-4 text-[15px] font-semibold text-white after:hidden hover:bg-white/10 hover:text-white focus-visible:ring-[#f0b84b] data-[state=active]:bg-[#f0b84b] data-[state=active]:font-bold data-[state=active]:text-[#173f5f] data-[state=active]:shadow-md data-[state=active]:[&_svg]:text-[#173f5f] md:w-full"
              >
                <item.icon className="size-5 text-[#f0b84b]" />
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="hidden px-6 md:absolute md:bottom-7 md:block">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#f0b84b]">Tax close</p>
            <p className="mt-2 text-sm font-medium text-white/90">{monthLabel(selectedMonth)}</p>
            <div className="mt-3 flex items-center gap-3">
              <Progress value={closeProgress} className="h-2 w-28 bg-[#315672]" />
              <span className="text-sm font-semibold">{closeProgress}%</span>
            </div>
            <form action="/api/auth/logout" method="post" className="mt-5 border-t border-[#315672] pt-4">
              <button className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0b84b]">
                <LogOut className="size-4 text-[#f0b84b]" />
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <div className="min-w-0 flex-1 md:ml-64">
          <header data-no-print className="sticky top-0 z-30 border-b bg-white/90 px-4 py-4 backdrop-blur md:px-8">
            <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Welcome back, {displayName}</p>
                <h1 className="text-xl font-bold tracking-[-.025em] text-[#173f5f] md:text-2xl">
                  Your rental portfolio
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <form action="/api/auth/logout" method="post" className="md:hidden">
                  <Button type="submit" variant="outline" size="icon" aria-label="Sign out">
                    <LogOut className="size-4" />
                  </Button>
                </form>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[145px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((month) => (
                      <SelectItem key={month} value={month}>{monthLabel(month)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={transactionOpen} onOpenChange={setTransactionOpen}>
                  <DialogTrigger asChild>
                    <Button disabled={!data.properties.length} className="bg-[#173f5f]">
                      <Plus className="size-4" />
                      <span className="hidden sm:inline">Add entry</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                      <DialogTitle>Record income or expense</DialogTitle>
                      <DialogDescription>
                        Add the details now so the month-end report is ready later.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitTransaction} className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
                        {(["income", "expense"] as const).map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => setTransactionKind(kind)}
                            className={`rounded-lg px-4 py-2.5 text-sm font-semibold capitalize transition ${transactionKind === kind ? "bg-white text-[#173f5f] shadow-sm" : "text-muted-foreground"}`}
                          >
                            {kind}
                          </button>
                        ))}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="entry-property">Property</Label>
                          <Select name="propertyId" required>
                            <SelectTrigger id="entry-property" className="w-full"><SelectValue placeholder="Choose property" /></SelectTrigger>
                            <SelectContent>
                              {data.properties.map((property) => (
                                <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="entry-date">Date</Label>
                          <Input id="entry-date" name="date" type="date" defaultValue={`${selectedMonth}-01`} required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="entry-amount">Amount</Label>
                          <Input id="entry-amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="entry-category">Category</Label>
                          <Select name="category" required>
                            <SelectTrigger id="entry-category" className="w-full"><SelectValue placeholder="Choose category" /></SelectTrigger>
                            <SelectContent>
                              {(transactionKind === "income" ? incomeCategories : expenseCategories).map((category) => (
                                <SelectItem key={category} value={category}>{category}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="counterparty">{transactionKind === "income" ? "Tenant / platform" : "Paid to"}</Label>
                          <Input id="counterparty" name="counterparty" placeholder={transactionKind === "income" ? "Tenant, Airbnb, Vrbo…" : "Vendor or company"} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="payment-method">Account / method</Label>
                          <Input id="payment-method" name="paymentMethod" placeholder="Business checking, card…" />
                        </div>
                        {transactionKind === "expense" && (
                          <div className="space-y-2">
                            <Label htmlFor="tax-treatment">Tax treatment</Label>
                            <Select name="taxTreatment" defaultValue="deductible">
                              <SelectTrigger id="tax-treatment" className="w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="deductible">Potentially deductible</SelectItem>
                                <SelectItem value="non_deductible">Non-deductible</SelectItem>
                                <SelectItem value="review">Needs tax review</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {transactionKind === "expense" && (
                          <label className="flex items-center gap-3 self-end rounded-lg border px-3 py-2.5 text-sm">
                            <input name="receiptOnFile" type="checkbox" className="size-4 accent-[#173f5f]" />
                            Receipt is on file
                          </label>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="entry-notes">Notes</Label>
                        <Textarea id="entry-notes" name="notes" placeholder="Optional note for your records or tax preparer" />
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={saving}>
                          {saving && <Loader2 className="size-4 animate-spin" />}
                          Save entry
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </header>

          <main className="ledger-grid mx-auto min-h-[calc(100vh-81px)] max-w-[1480px] p-4 md:p-8">
            {data.starterData && (
              <Alert className="mb-6 border-[#e4c77e] bg-[#fff8e7]" data-no-print>
                <CircleDollarSign className="size-4 text-[#8a6112]" />
                <AlertTitle>Example portfolio data is turned on</AlertTitle>
                <AlertDescription className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Explore with your five-unit setup, then clear the examples before entering live figures.
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit bg-white"
                    disabled={saving}
                    onClick={async () => {
                      if (!window.confirm("Clear all example properties, transactions, and occupancy records?")) return;
                      await mutate({ action: "clear_starter" });
                      toast.success("Example data cleared");
                      setTab("properties");
                    }}
                  >
                    Clear example data
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <TabsContent value="overview" className="mt-0 space-y-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[.12em] text-[#8a6112]">Monthly pulse</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-[-.03em]">{monthLabel(selectedMonth)}</h2>
                </div>
                <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                  <SelectTrigger className="w-full bg-white sm:w-[230px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All properties</SelectItem>
                    {data.properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Income received" value={money(totals.income, true)} detail={`${monthTransactions.filter((item) => item.kind === "income").length} deposits recorded`} icon={TrendingUp} tone="green" />
                <StatCard label="Expenses paid" value={money(totals.expenses, true)} detail={`${expensesThisMonth.length} expense entries`} icon={TrendingDown} tone="gold" />
                <StatCard label="Cash flow" value={money(totals.net, true)} detail={totals.income ? `${Math.round((totals.net / totals.income) * 100)}% margin` : "No income entered"} icon={WalletCards} tone="navy" />
                <StatCard label="STR occupancy" value={monthOccupancy.length ? `${totals.occupancy}%` : "—"} detail={monthOccupancy.length ? `${totals.vacantNights} vacant nights` : "Add occupancy data"} icon={CalendarDays} tone="slate" />
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,.75fr)]">
                <section data-print-card className="rounded-2xl border bg-white p-5 shadow-[0_8px_24px_rgba(23,63,95,.06)] md:p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">Six-month cash flow</h3>
                      <p className="text-sm text-muted-foreground">Income compared with expenses</p>
                    </div>
                    <Badge variant="secondary">Net {money(chartData.at(-1)?.net || 0, true)}</Badge>
                  </div>
                  <ChartContainer
                    className="h-[280px] w-full"
                    config={{
                      income: { label: "Income", color: "#2f7d69" },
                      expenses: { label: "Expenses", color: "#d89b22" },
                    }}
                  >
                    <AreaChart data={chartData} margin={{ left: -12, right: 10, top: 8 }}>
                      <defs>
                        <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2f7d69" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#2f7d69" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(value) => money(Number(value), true)} tickLine={false} axisLine={false} width={52} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => <><span className="text-muted-foreground">{String(name)}</span><span className="ml-auto font-mono font-semibold">{money(Number(value))}</span></>} />} />
                      <Area type="monotone" dataKey="income" stroke="#2f7d69" fill="url(#income-fill)" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="expenses" stroke="#d89b22" fill="transparent" strokeWidth={2.5} />
                    </AreaChart>
                  </ChartContainer>
                </section>

                <section data-print-card className="rounded-2xl border bg-[#173f5f] p-5 text-white shadow-[0_12px_32px_rgba(23,63,95,.16)] md:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-100">Month-end readiness</p>
                      <h3 className="mt-1 text-2xl font-bold">{closeProgress}% ready</h3>
                    </div>
                    <span className="grid size-11 place-items-center rounded-xl bg-white/10">
                      <FileCheck2 className="size-5 text-[#f0b84b]" />
                    </span>
                  </div>
                  <Progress value={closeProgress} className="my-5 h-2.5 bg-white/15" />
                  <div className="space-y-3">
                    {closeChecks.map((check) => (
                      <div key={check.label} className="flex items-center gap-3 text-sm">
                        <span className={`grid size-5 place-items-center rounded-full ${check.done ? "bg-[#f0b84b] text-[#173f5f]" : "border border-white/35"}`}>
                          {check.done && <Check className="size-3.5" />}
                        </span>
                        <span className={check.done ? "text-white" : "text-blue-100"}>{check.label}</span>
                      </div>
                    ))}
                  </div>
                  {!isClosed ? (
                    <Button
                      className="mt-6 w-full bg-[#f0b84b] text-[#173f5f] hover:bg-[#ffd375]"
                      disabled={saving}
                      onClick={async () => {
                        await mutate({ action: "close_month", month: selectedMonth, notes: "Reviewed in Rental Steward." });
                        toast.success(`${monthLabel(selectedMonth)} closed`);
                      }}
                    >
                      Review and close month
                    </Button>
                  ) : (
                    <div className="mt-6 rounded-xl bg-white/10 px-4 py-3 text-center text-sm font-semibold">
                      Month closed
                    </div>
                  )}
                </section>
              </div>

              <section data-print-card className="rounded-2xl border bg-white shadow-[0_8px_24px_rgba(23,63,95,.06)]">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <div>
                    <h3 className="font-bold">Recent activity</h3>
                    <p className="text-sm text-muted-foreground">Income and expenses for this month</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setTab("transactions")}>
                    View all <ChevronRight className="size-4" />
                  </Button>
                </div>
                <TransactionTable
                  rows={recentTransactions}
                  properties={data.properties}
                  onDelete={(id) => void mutate({ action: "delete_transaction", id })}
                  compact
                />
              </section>
            </TabsContent>

            <TabsContent value="transactions" className="mt-0 space-y-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[.12em] text-[#8a6112]">Ledger</p>
                  <h2 className="mt-1 text-2xl font-bold">Transactions</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{monthTransactions.length} entries in {monthLabel(selectedMonth)}</p>
                </div>
                <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                  <SelectTrigger className="w-full bg-white sm:w-[230px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All properties</SelectItem>
                    {data.properties.map((property) => <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_rgba(23,63,95,.06)]">
                <TransactionTable
                  rows={monthTransactions}
                  properties={data.properties}
                  onDelete={(id) => void mutate({ action: "delete_transaction", id })}
                />
              </section>
            </TabsContent>

            <TabsContent value="occupancy" className="mt-0 space-y-6">
              <CalendarSync properties={data.properties} month={selectedMonth} />
              <CleanerSchedule onLedgerChange={load} />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[.12em] text-[#8a6112]">Short-term rentals</p>
                <h2 className="mt-1 text-2xl font-bold">Occupancy & vacancy</h2>
                <p className="mt-1 text-sm text-muted-foreground">See booked nights, open nights, average daily rate, and revenue.</p>
              </div>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_rgba(23,63,95,.06)]">
                  <div className="border-b px-5 py-4">
                    <h3 className="font-bold">{monthLabel(selectedMonth)} performance</h3>
                  </div>
                  <div className="grid gap-4 p-5 sm:grid-cols-2">
                    {shortTermProperties.map((property) => {
                      const row = data.occupancy.find((item) => item.month === selectedMonth && item.propertyId === property.id);
                      const rate = row?.availableNights ? Math.round((row.bookedNights / row.availableNights) * 100) : 0;
                      const adr = row?.bookedNights ? row.revenue / row.bookedNights : 0;
                      return (
                        <article key={property.id} className="rounded-xl border bg-[#f9fbfc] p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold">{property.name}</h4>
                              <p className="text-sm text-muted-foreground">{property.groupName}</p>
                            </div>
                            <Badge className="bg-[#e6f2ee] text-[#2f7d69]">{row ? `${rate}%` : "No data"}</Badge>
                          </div>
                          <Progress value={rate} className="my-4 h-2" />
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div><p className="text-lg font-bold">{row?.bookedNights ?? 0}</p><p className="text-xs text-muted-foreground">Booked</p></div>
                            <div><p className="text-lg font-bold">{row ? row.availableNights - row.bookedNights : 0}</p><p className="text-xs text-muted-foreground">Vacant</p></div>
                            <div><p className="text-lg font-bold">{money(adr, true)}</p><p className="text-xs text-muted-foreground">ADR</p></div>
                          </div>
                        </article>
                      );
                    })}
                    {!shortTermProperties.length && (
                      <p className="col-span-full py-10 text-center text-muted-foreground">Add a short-term rental to begin tracking occupancy.</p>
                    )}
                  </div>
                </section>
                <form onSubmit={submitOccupancy} className="h-fit space-y-4 rounded-2xl border bg-white p-5 shadow-[0_8px_24px_rgba(23,63,95,.06)]">
                  <div>
                    <h3 className="font-bold">Update monthly occupancy</h3>
                    <p className="text-sm text-muted-foreground">Enter the final platform totals or update them during the month.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupancy-property">Short-term rental</Label>
                    <Select name="propertyId" required>
                      <SelectTrigger id="occupancy-property" className="w-full"><SelectValue placeholder="Choose rental" /></SelectTrigger>
                      <SelectContent>
                        {shortTermProperties.map((property) => <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupancy-month">Month</Label>
                    <Input id="occupancy-month" name="month" type="month" defaultValue={selectedMonth} required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="available-nights">Available nights</Label>
                      <Input id="available-nights" name="availableNights" type="number" min="1" max="31" defaultValue="30" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="booked-nights">Booked nights</Label>
                      <Input id="booked-nights" name="bookedNights" type="number" min="0" max="31" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupancy-revenue">Booking revenue</Label>
                    <Input id="occupancy-revenue" name="revenue" type="number" min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <Button type="submit" className="w-full" disabled={saving || !shortTermProperties.length}>
                    {saving && <Loader2 className="size-4 animate-spin" />} Save occupancy
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="reports" className="mt-0 space-y-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[.12em] text-[#8a6112]">Accountant-ready</p>
                  <h2 className="mt-1 text-2xl font-bold">Financial & tax reports</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Review cash flow and deductible expense categories before year-end.</p>
                </div>
                <div data-no-print className="flex flex-wrap gap-2">
                  <Select value={reportPeriod} onValueChange={(value) => setReportPeriod(value as "month" | "quarter")}>
                    <SelectTrigger className="w-[125px] bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="quarter">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={exportCsv}><Download className="size-4" /> CSV</Button>
                  <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Gross income" value={money(reportIncome, true)} detail={reportPeriod === "month" ? monthLabel(selectedMonth) : `Q${Math.floor((Number(selectedMonth.slice(5)) - 1) / 3) + 1} ${selectedMonth.slice(0, 4)}`} icon={TrendingUp} tone="green" />
                <StatCard label="Cash expenses" value={money(reportExpenses, true)} detail="Includes principal and review items" icon={TrendingDown} tone="gold" />
                <StatCard label="Net cash flow" value={money(reportIncome - reportExpenses, true)} detail="Before income taxes" icon={WalletCards} tone="navy" />
                <StatCard label="Potential deductions" value={money(reportDeductible, true)} detail="Confirm with your tax professional" icon={FileCheck2} tone="slate" />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <section data-print-card className="rounded-2xl border bg-white p-5 shadow-[0_8px_24px_rgba(23,63,95,.06)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">Schedule E categories</h3>
                      <p className="text-sm text-muted-foreground">Potentially deductible expenses entered for this period</p>
                    </div>
                    <Badge variant="secondary">{taxBreakdown.length} categories</Badge>
                  </div>
                  <div className="mt-5 space-y-4">
                    {taxBreakdown.map(([category, amount]) => (
                      <div key={category}>
                        <div className="mb-1.5 flex justify-between gap-4 text-sm">
                          <span>{category}</span><span className="font-semibold">{money(amount)}</span>
                        </div>
                        <Progress value={reportDeductible ? (amount / reportDeductible) * 100 : 0} className="h-1.5" />
                      </div>
                    ))}
                    {!taxBreakdown.length && <p className="py-10 text-center text-muted-foreground">No deductible expenses entered for this period.</p>}
                  </div>
                </section>
                <section data-print-card className="rounded-2xl border bg-white p-5 shadow-[0_8px_24px_rgba(23,63,95,.06)]">
                  <h3 className="font-bold">Tax file health</h3>
                  <p className="text-sm text-muted-foreground">Items to resolve before sending records to your preparer</p>
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-[#f7f9fa] p-4">
                      <span className="text-sm">Missing receipt confirmations</span>
                      <Badge variant={missingReceipts ? "destructive" : "secondary"}>{missingReceipts}</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-[#f7f9fa] p-4">
                      <span className="text-sm">Expenses needing tax review</span>
                      <Badge variant={needsTaxReview ? "destructive" : "secondary"}>{needsTaxReview}</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-[#f7f9fa] p-4">
                      <span className="text-sm">Month close status</span>
                      <Badge className={isClosed ? "bg-[#e6f2ee] text-[#2f7d69]" : "bg-[#fff3d6] text-[#8a6112]"}>{isClosed ? "Closed" : "Open"}</Badge>
                    </div>
                    <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
                      Tax treatment is an organizing aid, not tax advice. Confirm deductions and depreciation with your tax professional.
                    </p>
                  </div>
                </section>
              </div>
            </TabsContent>

            <TabsContent value="properties" className="mt-0 space-y-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[.12em] text-[#8a6112]">Portfolio setup</p>
                  <h2 className="mt-1 text-2xl font-bold">Properties</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Organize each long-term or short-term rental separately.</p>
                </div>
                <Dialog open={propertyOpen} onOpenChange={setPropertyOpen}>
                  <DialogTrigger asChild><Button><Plus className="size-4" /> Add property</Button></DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                      <DialogTitle>Add a rental</DialogTitle>
                      <DialogDescription>Create one record for each unit you want to track.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitProperty} className="space-y-4">
                      <div className="space-y-2"><Label htmlFor="property-name">Property / unit name</Label><Input id="property-name" name="name" placeholder="Unit 1, Main House…" required /></div>
                      <div className="space-y-2"><Label htmlFor="group-name">Building or group</Label><Input id="group-name" name="groupName" placeholder="Main Street Fourplex" /></div>
                      <div className="space-y-2">
                        <Label htmlFor="rental-type">Rental type</Label>
                        <Select name="rentalType" required>
                          <SelectTrigger id="rental-type" className="w-full"><SelectValue placeholder="Choose type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="long_term">Long-term rental</SelectItem>
                            <SelectItem value="short_term">Short-term rental</SelectItem>
                            <SelectItem value="mixed">Mixed use</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label htmlFor="property-address">Address</Label><Input id="property-address" name="address" placeholder="Optional" /></div>
                      <div className="space-y-2">
                        <Label htmlFor="tenant-name">Tenant / guest label</Label>
                        <Input id="tenant-name" name="tenantName" placeholder="Tenant name or Short-term guests" />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="monthly-rent">Monthly rent</Label>
                          <Input id="monthly-rent" name="monthlyRent" type="number" min="0" step="0.01" placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="estimated-costs">Estimated monthly costs</Label>
                          <Input id="estimated-costs" name="estimatedMonthlyCosts" type="number" min="0" step="0.01" placeholder="0.00" />
                        </div>
                      </div>
                      {propertySaveError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{propertySaveError}</p>}
                      <DialogFooter><Button type="submit" disabled={saving} aria-busy={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{saving ? "Saving rental…" : "Add rental"}</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              {data.properties.length > 0 && (
                <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_10px_28px_rgba(23,63,95,.08)]">
                  <div className="flex flex-col gap-4 border-b bg-[#f8fafb] p-5 md:flex-row md:items-end md:justify-between">
                    <div className="w-full md:max-w-md">
                      <Label htmlFor="property-summary-select" className="mb-2 block text-sm font-semibold text-[#173f5f]">
                        Select a property
                      </Label>
                      <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                        <SelectTrigger id="property-summary-select" className="h-11 w-full bg-white text-base">
                          <SelectValue placeholder="Choose a property" />
                        </SelectTrigger>
                        <SelectContent>
                          {data.properties.map((property) => (
                            <SelectItem key={property.id} value={property.id}>
                              {property.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedProperty && (
                      <Dialog open={propertyDetailsOpen} onOpenChange={setPropertyDetailsOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="bg-white">
                            <PencilLine className="size-4" /> Edit property details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                          <DialogHeader>
                            <DialogTitle>Edit {selectedProperty.name}</DialogTitle>
                            <DialogDescription>
                              Keep the tenant, monthly rent, and expected costs current.
                            </DialogDescription>
                          </DialogHeader>
                          <form key={selectedProperty.id} onSubmit={updateProperty} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="edit-property-name">Property / unit name</Label>
                              <Input id="edit-property-name" name="name" defaultValue={selectedProperty.name} required />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-group-name">Building or group</Label>
                              <Input id="edit-group-name" name="groupName" defaultValue={selectedProperty.groupName} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-rental-type">Rental type</Label>
                              <Select name="rentalType" defaultValue={selectedProperty.rentalType} required>
                                <SelectTrigger id="edit-rental-type" className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="long_term">Long-term rental</SelectItem>
                                  <SelectItem value="short_term">Short-term rental</SelectItem>
                                  <SelectItem value="mixed">Mixed use</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-property-address">Address</Label>
                              <Input id="edit-property-address" name="address" defaultValue={selectedProperty.address} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-tenant-name">Tenant / guest label</Label>
                              <Input id="edit-tenant-name" name="tenantName" defaultValue={selectedProperty.tenantName} />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="edit-monthly-rent">Monthly rent</Label>
                                <Input id="edit-monthly-rent" name="monthlyRent" type="number" min="0" step="0.01" defaultValue={selectedProperty.monthlyRent} />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-estimated-costs">Estimated monthly costs</Label>
                                <Input id="edit-estimated-costs" name="estimatedMonthlyCosts" type="number" min="0" step="0.01" defaultValue={selectedProperty.estimatedMonthlyCosts} />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="size-4 animate-spin" />} Save details
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                  {selectedProperty && (
                    <div className="p-5 md:p-6">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold tracking-[-.025em]">{selectedProperty.name}</h3>
                            <Badge variant="secondary">
                              {selectedProperty.rentalType === "short_term"
                                ? "Short-term"
                                : selectedProperty.rentalType === "long_term"
                                  ? "Long-term"
                                  : "Mixed"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {selectedProperty.groupName || selectedProperty.address || "No building group entered"}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">{monthLabel(selectedMonth)} actuals</p>
                      </div>
                      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="rounded-xl bg-[#f5f7fa] p-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <UserRound className="size-4" /> Tenant
                          </div>
                          <p className="mt-2 font-bold">{selectedProperty.tenantName || "Not entered"}</p>
                        </div>
                        <div className="rounded-xl bg-[#eaf5f1] p-4">
                          <p className="text-sm text-[#477467]">Monthly rent</p>
                          <p className="mt-2 text-xl font-bold text-[#2f7d69]">{money(Number(selectedProperty.monthlyRent))}</p>
                        </div>
                        <div className="rounded-xl bg-[#fff7e4] p-4">
                          <p className="text-sm text-[#80601d]">Estimated costs</p>
                          <p className="mt-2 text-xl font-bold text-[#8a6112]">{money(Number(selectedProperty.estimatedMonthlyCosts))}</p>
                        </div>
                        <div className="rounded-xl bg-[#e9f0f5] p-4">
                          <p className="text-sm text-[#4d6679]">Expected cash flow</p>
                          <p className="mt-2 text-xl font-bold text-[#173f5f]">
                            {money(Number(selectedProperty.monthlyRent) - Number(selectedProperty.estimatedMonthlyCosts))}
                          </p>
                        </div>
                        <div className="rounded-xl border border-[#dce3e9] p-4">
                          <p className="text-sm text-muted-foreground">Actual cash flow</p>
                          <p className="mt-2 text-xl font-bold">
                            {money(selectedPropertyActualIncome - selectedPropertyActualExpenses)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.properties.map((property) => {
                  const propertyTransactions = data.transactions.filter((item) => item.propertyId === property.id && item.date.startsWith(selectedMonth));
                  const income = propertyTransactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + Number(item.amount), 0);
                  const expenses = propertyTransactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
                  return (
                    <button
                      type="button"
                      key={property.id}
                      onClick={() => setSelectedPropertyId(property.id)}
                      className={`rounded-2xl border bg-white p-5 text-left shadow-[0_8px_24px_rgba(23,63,95,.06)] transition hover:-translate-y-0.5 hover:border-[#8eabbf] ${selectedPropertyId === property.id ? "ring-2 ring-[#d89b22]/55" : ""}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="grid size-11 place-items-center rounded-xl bg-[#e9f0f5] text-[#173f5f]"><Building2 className="size-5" /></span>
                        <Badge variant="secondary">{property.rentalType === "short_term" ? "Short-term" : property.rentalType === "long_term" ? "Long-term" : "Mixed"}</Badge>
                      </div>
                      <h3 className="mt-4 font-bold">{property.name}</h3>
                      <p className="text-sm text-muted-foreground">{property.groupName || property.address || "No building group"}</p>
                      <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4">
                        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Income</p><p className="mt-1 font-bold text-[#2f7d69]">{money(income, true)}</p></div>
                        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Net</p><p className="mt-1 font-bold">{money(income - expenses, true)}</p></div>
                      </div>
                    </button>
                  );
                })}
                {!data.properties.length && (
                  <button type="button" onClick={() => setPropertyOpen(true)} className="min-h-56 rounded-2xl border border-dashed bg-white/60 p-6 text-center text-muted-foreground hover:border-[#173f5f] hover:text-[#173f5f]">
                    <Plus className="mx-auto mb-3 size-6" />
                    Add your first rental
                  </button>
                )}
              </div>
            </TabsContent>
          </main>
        </div>
      </Tabs>
      <Toaster richColors position="top-right" />
    </>
  );
}

function TransactionTable({
  rows,
  properties,
  onDelete,
  compact = false,
}: {
  rows: Transaction[];
  properties: Property[];
  onDelete: (id: string) => void;
  compact?: boolean;
}) {
  if (!rows.length) {
    return <div className="px-5 py-14 text-center text-sm text-muted-foreground">No transactions for this selection.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Category</TableHead>
            {!compact && <TableHead>Paid by / to</TableHead>}
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${row.date}T00:00:00Z`))}
              </TableCell>
              <TableCell className="min-w-44 font-medium">{propertyName(properties, row.propertyId)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${row.kind === "income" ? "bg-[#2f7d69]" : "bg-[#d89b22]"}`} />
                  <span className="whitespace-nowrap">{row.category}</span>
                  {row.kind === "expense" && !Boolean(row.receiptOnFile) && <Badge variant="outline" className="hidden text-[11px] sm:inline-flex">Receipt</Badge>}
                </div>
              </TableCell>
              {!compact && <TableCell className="min-w-40 text-muted-foreground">{row.counterparty || "—"}</TableCell>}
              <TableCell className={`whitespace-nowrap text-right font-semibold tabular-nums ${row.kind === "income" ? "text-[#2f7d69]" : "text-foreground"}`}>
                {row.kind === "income" ? "+" : "−"}{money(Number(row.amount))}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" aria-label="Delete transaction" onClick={() => {
                  if (window.confirm("Delete this transaction?")) onDelete(row.id);
                }}>
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
