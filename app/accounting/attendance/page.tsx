"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/app/context/AuthContext";
import {
  Users,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  UserCheck,
  DollarSign,
  TrendingDown,
  ShieldCheck,
  Fingerprint,
  FileSpreadsheet,
  Check,
  X,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Info,
  Building2,
  Wallet,
  ArrowRight,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { playScanSuccessSound } from "@/app/libs/audio";

interface SalariedEmployee {
  id: string;
  biometricPin?: string | null;
  name: string;
  phone?: string | null;
  department: string;
  designation: string;
  salaryType: string;
  baseSalary: number;
  annualLeaveQuota: number;
  joiningDate: string;
  isActive: boolean;
  year?: number;
  paidLeavesUsed: number;
  unpaidLeavesUsed: number;
  totalLeavesUsed: number;
  remainingQuota: number;
}

interface DailyAttendanceRow {
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  baseSalary: number;
  biometricPin?: string | null;
  annualLeaveQuota: number;
  paidLeavesUsed: number;
  unpaidLeavesUsed: number;
  remainingQuota: number;
  attendance: {
    id: string;
    status: string;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    workingHours?: number | null;
    source: string;
    notes?: string | null;
  } | null;
}

interface MonthlyEmployeeMatrix {
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  baseSalary: number;
  annualLeaveQuota: number;
  dailyMap: Record<number, string>;
  summary: {
    daysPresent: number;
    halfDays: number;
    paidLeaves: number;
    unpaidLeaves: number;
    absentDays: number;
    deductionDays: number;
  };
}

interface PayrollRow {
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  salaryType: string;
  baseSalary: number;
  annualLeaveQuota: number;
  totalWorkingDays: number;
  daysPresent: number;
  halfDays: number;
  paidLeaves: number;
  unpaidLeaves: number;
  absentDays: number;
  deductionDays: number;
  dailyRate: number;
  deductionAmount: number;
  netSalary: number;
  slipStatus: string;
  paidAt?: string | null;
  paidBy?: string | null;
  paymentMethod?: string | null;
}

const DEPARTMENTS = [
  "All",
  "Cutting",
  "Sewing",
  "Store",
  "Quality",
  "Accounting",
  "Administration",
  "Security",
  "General",
];

export default function AttendancePage() {
  const { user } = useAuth();

  // Active Tab: "daily" | "employees" | "monthly" | "payroll"
  const [activeTab, setActiveTab] = useState<"daily" | "employees" | "monthly" | "payroll">("daily");

  // Filter States
  const [selectedDept, setSelectedDept] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Daily Register State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dailyRows, setDailyRows] = useState<DailyAttendanceRow[]>([]);
  const [dailySummary, setDailySummary] = useState({
    totalEmployees: 0,
    present: 0,
    halfDay: 0,
    leave: 0,
    absent: 0,
    unmarked: 0,
  });
  const [modifiedDailyMarks, setModifiedDailyMarks] = useState<Record<string, { status: string; notes?: string }>>({});
  const [savingDaily, setSavingDaily] = useState(false);

  // Employees List State
  const [employees, setEmployees] = useState<SalariedEmployee[]>([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<SalariedEmployee | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState({
    name: "",
    phone: "",
    department: "General",
    designation: "",
    salaryType: "monthly",
    baseSalary: "",
    annualLeaveQuota: "14",
    biometricPin: "",
  });

  // Monthly Matrix State
  const [matrixMonth, setMatrixMonth] = useState(() => new Date().getMonth() + 1);
  const [matrixYear, setMatrixYear] = useState(() => new Date().getFullYear());
  const [matrixEmployees, setMatrixEmployees] = useState<MonthlyEmployeeMatrix[]>([]);
  const [matrixDaysCount, setMatrixDaysCount] = useState(30);

  // Payroll Calculation State
  const [payrollMonth, setPayrollMonth] = useState(() => new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(() => new Date().getFullYear());
  const [payrollWorkingDays, setPayrollWorkingDays] = useState(26);
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [payrollSummary, setPayrollSummary] = useState({
    totalEmployees: 0,
    totalGrossPayroll: 0,
    totalDeductions: 0,
    totalNetPayroll: 0,
  });
  const [payingEmployee, setPayingEmployee] = useState<PayrollRow | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [payingSalary, setPayingSalary] = useState(false);

  // Loading States
  const [loading, setLoading] = useState(false);

  // =========================================================================
  // 1. DATA FETCHING
  // =========================================================================

  // Fetch Daily Register
  const fetchDailyAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/attendance/daily?date=${selectedDate}&department=${selectedDept.toLowerCase()}`);
      const data = await res.json();
      if (data.success) {
        setDailyRows(data.records);
        setDailySummary(data.summary);

        // Pre-populate modified state
        const initialMap: Record<string, { status: string; notes?: string }> = {};
        for (const row of data.records) {
          if (row.attendance) {
            initialMap[row.employeeId] = {
              status: row.attendance.status,
              notes: row.attendance.notes || "",
            };
          }
        }
        setModifiedDailyMarks(initialMap);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load daily attendance");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedDept]);

  // Fetch Employees
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/attendance/employees?department=${selectedDept.toLowerCase()}`);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [selectedDept]);

  // Fetch Monthly Matrix
  const fetchMonthlyMatrix = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/attendance/monthly?month=${matrixMonth}&year=${matrixYear}&department=${selectedDept.toLowerCase()}`
      );
      const data = await res.json();
      if (data.success) {
        setMatrixEmployees(data.employees);
        setMatrixDaysCount(data.daysInMonth);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load monthly matrix");
    } finally {
      setLoading(false);
    }
  }, [matrixMonth, matrixYear, selectedDept]);

  // Fetch Payroll Sheet
  const fetchPayroll = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/attendance/payroll?month=${payrollMonth}&year=${payrollYear}&workingDays=${payrollWorkingDays}&department=${selectedDept.toLowerCase()}`
      );
      const data = await res.json();
      if (data.success) {
        setPayrollRows(data.payroll);
        setPayrollSummary(data.summary);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to calculate payroll");
    } finally {
      setLoading(false);
    }
  }, [payrollMonth, payrollYear, payrollWorkingDays, selectedDept]);

  // Tab switch trigger
  useEffect(() => {
    if (activeTab === "daily") fetchDailyAttendance();
    else if (activeTab === "employees") fetchEmployees();
    else if (activeTab === "monthly") fetchMonthlyMatrix();
    else if (activeTab === "payroll") fetchPayroll();
  }, [activeTab, fetchDailyAttendance, fetchEmployees, fetchMonthlyMatrix, fetchPayroll]);

  // =========================================================================
  // 2. DAILY ATTENDANCE ACTIONS
  // =========================================================================

  const handleMarkChange = (employeeId: string, status: string) => {
    setModifiedDailyMarks((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        status,
      },
    }));
  };

  const handleNotesChange = (employeeId: string, notes: string) => {
    setModifiedDailyMarks((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        status: prev[employeeId]?.status || "PRESENT",
        notes,
      },
    }));
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, { status: string; notes?: string }> = { ...modifiedDailyMarks };
    for (const r of dailyRows) {
      updated[r.employeeId] = {
        status: "PRESENT",
        notes: updated[r.employeeId]?.notes || "",
      };
    }
    setModifiedDailyMarks(updated);
    playScanSuccessSound();
    toast.success("Marked all staff as Present. Click 'Save Attendance' to persist.");
  };

  const handleSaveDailyAttendance = async () => {
    setSavingDaily(true);
    try {
      const recordsToSave = Object.entries(modifiedDailyMarks).map(([employeeId, data]) => ({
        employeeId,
        status: data.status,
        notes: data.notes,
      }));

      if (recordsToSave.length === 0) {
        toast.error("No marks to save");
        return;
      }

      const res = await fetch("/api/attendance/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          records: recordsToSave,
        }),
      });

      const data = await res.json();
      if (data.success) {
        playScanSuccessSound();
        toast.success(data.message);
        if (data.notifications?.length > 0) {
          for (const notif of data.notifications) {
            toast(notif, { icon: "⚠️", duration: 6000 });
          }
        }
        fetchDailyAttendance();
      } else {
        toast.error(data.message || "Failed to save attendance");
      }
    } catch (err: any) {
      toast.error(err.message || "Error saving attendance");
    } finally {
      setSavingDaily(false);
    }
  };

  // =========================================================================
  // 3. EMPLOYEE CREATION & LEAVE QUOTA
  // =========================================================================

  const openCreateEmployeeModal = () => {
    setEditingEmployee(null);
    setEmployeeFormData({
      name: "",
      phone: "",
      department: "General",
      designation: "",
      salaryType: "monthly",
      baseSalary: "",
      annualLeaveQuota: "14",
      biometricPin: "",
    });
    setShowEmployeeModal(true);
  };

  const openEditEmployeeModal = (emp: SalariedEmployee) => {
    setEditingEmployee(emp);
    setEmployeeFormData({
      name: emp.name,
      phone: emp.phone || "",
      department: emp.department,
      designation: emp.designation,
      salaryType: emp.salaryType,
      baseSalary: emp.baseSalary.toString(),
      annualLeaveQuota: emp.annualLeaveQuota.toString(),
      biometricPin: emp.biometricPin || "",
    });
    setShowEmployeeModal(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeFormData.name || !employeeFormData.designation || !employeeFormData.baseSalary) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const isEditing = Boolean(editingEmployee);
      const url = "/api/attendance/employees";
      const method = isEditing ? "PUT" : "POST";
      const payload = {
        ...(isEditing ? { id: editingEmployee?.id } : {}),
        ...employeeFormData,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setShowEmployeeModal(false);
        fetchEmployees();
      } else {
        toast.error(data.message || "Failed to save employee");
      }
    } catch (err: any) {
      toast.error(err.message || "Error saving employee");
    }
  };

  // =========================================================================
  // 4. PAYROLL PAYMENT MODAL
  // =========================================================================

  const handlePaySalaryConfirm = async () => {
    if (!payingEmployee) return;
    setPayingSalary(true);
    try {
      const res = await fetch("/api/attendance/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: payingEmployee.employeeId,
          month: payrollMonth,
          year: payrollYear,
          totalWorkingDays: payrollWorkingDays,
          daysPresent: payingEmployee.daysPresent,
          paidLeaves: payingEmployee.paidLeaves,
          unpaidLeaves: payingEmployee.unpaidLeaves,
          absentDays: payingEmployee.absentDays,
          baseSalary: payingEmployee.baseSalary,
          dailyRate: payingEmployee.dailyRate,
          deductionAmount: payingEmployee.deductionAmount,
          netSalary: payingEmployee.netSalary,
          paymentMethod,
          paidBy: user?.name || "Admin",
        }),
      });

      const data = await res.json();
      if (data.success) {
        playScanSuccessSound();
        toast.success(data.message);
        setPayingEmployee(null);
        fetchPayroll();
      } else {
        toast.error(data.message || "Failed to process salary payment");
      }
    } catch (err: any) {
      toast.error(err.message || "Error processing payment");
    } finally {
      setPayingSalary(false);
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* ================= PAGE HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0">
            <UserCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Staff Attendance & Salaries
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                Annual Quota Engine
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Track salaried employee attendance, enforce annual paid leaves, and auto-calculate payroll deductions.
            </p>
          </div>
        </div>

        {/* Quick Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (activeTab === "daily") fetchDailyAttendance();
              else if (activeTab === "employees") fetchEmployees();
              else if (activeTab === "monthly") fetchMonthlyMatrix();
              else if (activeTab === "payroll") fetchPayroll();
            }}
            disabled={loading}
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-emerald-600" : "text-slate-500"} />
            Refresh
          </button>

          {activeTab === "employees" && (
            <button
              onClick={openCreateEmployeeModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus size={15} />
              Add Salaried Staff
            </button>
          )}
        </div>
      </div>

      {/* ================= NAVIGATION TABS ================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "daily"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <CalendarCheck size={14} />
            Daily Register
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("employees")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "employees"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Users size={14} />
            Staff & Quotas
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("monthly")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "monthly"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FileSpreadsheet size={14} />
            Monthly Matrix
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("payroll")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "payroll"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <DollarSign size={14} />
            Payroll & Deductions
          </button>
        </div>

        {/* Department Filter Dropdown */}
        <div className="flex items-center gap-2 px-2 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
          <span className="text-xs text-slate-400 font-medium">Department:</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

        {/* ========================================================================= */}
        {/* TAB 1: DAILY ATTENDANCE REGISTER                                          */}
        {/* ========================================================================= */}
        {activeTab === "daily" && (
          <div className="space-y-6">
            {/* Top Stat Cards & Date Selector */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-emerald-600" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Date:</span>
                  </div>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-400 font-medium">
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleMarkAllPresent}
                    className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    Mark All Present
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveDailyAttendance}
                    disabled={savingDaily}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {savingDaily ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    {savingDaily ? "Saving..." : "Save Daily Attendance"}
                  </button>
                </div>
              </div>

              {/* Status Metric Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mt-4">
                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl text-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Staff</span>
                  <p className="text-xl font-black text-slate-900 mt-0.5">{dailySummary.totalEmployees}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200/80 p-3 rounded-xl text-center">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Present</span>
                  <p className="text-xl font-black text-emerald-700 mt-0.5">{dailySummary.present}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-xl text-center">
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Half Day</span>
                  <p className="text-xl font-black text-amber-700 mt-0.5">{dailySummary.halfDay}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200/80 p-3 rounded-xl text-center">
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">On Leave</span>
                  <p className="text-xl font-black text-blue-700 mt-0.5">{dailySummary.leave}</p>
                </div>
                <div className="bg-rose-50 border border-rose-200/80 p-3 rounded-xl text-center">
                  <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wide">Absent</span>
                  <p className="text-xl font-black text-rose-700 mt-0.5">{dailySummary.absent}</p>
                </div>
                <div className="bg-gray-100 border border-gray-200 p-3 rounded-xl text-center">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Unmarked</span>
                  <p className="text-xl font-black text-gray-600 mt-0.5">{dailySummary.unmarked}</p>
                </div>
              </div>
            </div>

            {/* Daily Register Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 font-bold">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Annual Leaves</th>
                      <th className="py-3 px-4">Mark Today</th>
                      <th className="py-3 px-4">Notes / Remarks</th>
                      <th className="py-3 px-4 text-right">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {dailyRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No salaried employees found in this department. Add staff in Tab 2.
                        </td>
                      </tr>
                    ) : (
                      dailyRows.map((row) => {
                        const currentStatus = modifiedDailyMarks[row.employeeId]?.status || "UNMARKED";
                        const currentNotes = modifiedDailyMarks[row.employeeId]?.notes || "";

                        return (
                          <tr key={row.employeeId} className="hover:bg-slate-50/70 transition">
                            {/* Employee Info */}
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
                                  {row.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block">{row.name}</span>
                                  <span className="text-[11px] text-slate-400 font-normal">
                                    {row.designation} • Rs. {row.baseSalary.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Department */}
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {row.department}
                              </span>
                            </td>

                            {/* Annual Leaves Live Progress */}
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-1 max-w-[140px]">
                                <div className="flex items-center justify-between text-[11px] font-semibold">
                                  <span className="text-slate-600">
                                    {row.paidLeavesUsed} / {row.annualLeaveQuota} Used
                                  </span>
                                  <span
                                    className={`font-bold ${
                                      row.remainingQuota === 0 ? "text-rose-600" : "text-emerald-700"
                                    }`}
                                  >
                                    {row.remainingQuota} Left
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      row.remainingQuota === 0
                                        ? "bg-rose-500"
                                        : row.remainingQuota <= 2
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                    }`}
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        Math.max(5, (row.paidLeavesUsed / row.annualLeaveQuota) * 100)
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Quick Action Toggle Buttons */}
                            <td className="py-3.5 px-4">
                              <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1 border border-slate-200/60">
                                {/* Present */}
                                <button
                                  type="button"
                                  onClick={() => handleMarkChange(row.employeeId, "PRESENT")}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    currentStatus === "PRESENT"
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : "text-slate-600 hover:text-emerald-700"
                                  }`}
                                  title="Full Day Present"
                                >
                                  P
                                </button>

                                {/* Half Day */}
                                <button
                                  type="button"
                                  onClick={() => handleMarkChange(row.employeeId, "HALF_DAY")}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    currentStatus === "HALF_DAY"
                                      ? "bg-amber-500 text-white shadow-xs"
                                      : "text-slate-600 hover:text-amber-700"
                                  }`}
                                  title="Half Day (0.5 Day rate)"
                                >
                                  HD
                                </button>

                                {/* Leave */}
                                <button
                                  type="button"
                                  onClick={() => handleMarkChange(row.employeeId, "LEAVE")}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    currentStatus === "LEAVE" ||
                                    currentStatus === "PAID_LEAVE" ||
                                    currentStatus === "UNPAID_LEAVE"
                                      ? currentStatus === "UNPAID_LEAVE"
                                        ? "bg-rose-600 text-white shadow-xs"
                                        : "bg-blue-600 text-white shadow-xs"
                                      : "text-slate-600 hover:text-blue-700"
                                  }`}
                                  title={
                                    row.remainingQuota > 0
                                      ? `Authorized Leave (Deducts 1 from quota of ${row.remainingQuota})`
                                      : `Unpaid Leave (Quota exhausted! Salary will be deducted)`
                                  }
                                >
                                  {currentStatus === "UNPAID_LEAVE" ? "L (Unpaid)" : "L"}
                                </button>

                                {/* Absent */}
                                <button
                                  type="button"
                                  onClick={() => handleMarkChange(row.employeeId, "ABSENT")}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    currentStatus === "ABSENT"
                                      ? "bg-rose-600 text-white shadow-xs"
                                      : "text-slate-600 hover:text-rose-700"
                                  }`}
                                  title="Unexcused Absence (Salary Deducted)"
                                >
                                  A
                                </button>
                              </div>
                            </td>

                            {/* Remarks */}
                            <td className="py-3.5 px-4">
                              <input
                                type="text"
                                value={currentNotes}
                                onChange={(e) => handleNotesChange(row.employeeId, e.target.value)}
                                placeholder="Add note or reason..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>

                            {/* Source */}
                            <td className="py-3.5 px-4 text-right">
                              {row.attendance?.source === "BIOMETRIC" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                                  <Fingerprint size={12} /> Biometric
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-slate-400">Manual</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: STAFF & ANNUAL LEAVE QUOTA SETUP                                  */}
        {/* ========================================================================= */}
        {activeTab === "employees" && (
          <div className="space-y-6">
            {/* Employee Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Salaried Staff</span>
                  <p className="text-2xl font-black text-slate-900 mt-1">{employees.length}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Active staff on fixed salary</p>
                </div>
                <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
                  <Users size={22} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Monthly Payroll Liability</span>
                  <p className="text-2xl font-black text-emerald-700 mt-1">
                    Rs. {employees.reduce((acc, curr) => acc + curr.baseSalary, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Before leave deductions</p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                  <DollarSign size={22} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Standard Annual Quota</span>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    14 <span className="text-base font-semibold text-slate-500">Days / Year</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Configurable per employee</p>
                </div>
                <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                  <ShieldCheck size={22} />
                </div>
              </div>
            </div>

            {/* Employees Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Employee</th>
                      <th className="py-3.5 px-4">Department & Role</th>
                      <th className="py-3.5 px-4">Base Salary</th>
                      <th className="py-3.5 px-4">Annual Quota</th>
                      <th className="py-3.5 px-4">Leaves Used This Year</th>
                      <th className="py-3.5 px-4">Biometric ID</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {employees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No salaried staff registered yet. Click &quot;Add Salaried Staff&quot; above.
                        </td>
                      </tr>
                    ) : (
                      employees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {emp.name}
                            {emp.phone && <span className="text-[11px] text-slate-400 block font-normal">{emp.phone}</span>}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-900 block">{emp.designation}</span>
                            <span className="text-[11px] text-slate-400 block">
                              {emp.department
                                ? emp.designation.toLowerCase() === emp.department.toLowerCase()
                                  ? `${emp.department} Dept`
                                  : emp.department
                                : "General"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-emerald-700">
                            Rs. {emp.baseSalary.toLocaleString()}
                            <span className="text-[10px] text-slate-400 block font-normal">/ month</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 inline-flex items-center gap-1.5">
                              <Calendar size={12} className="text-slate-500" />
                              {emp.annualLeaveQuota} Days / Yr
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 max-w-[160px]">
                              <div className="flex items-center justify-between text-[11px] font-semibold">
                                <span className="text-slate-600">{emp.paidLeavesUsed} Paid</span>
                                <span className={emp.remainingQuota === 0 ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}>
                                  {emp.remainingQuota} Left
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    emp.remainingQuota === 0
                                      ? "bg-rose-500"
                                      : emp.remainingQuota <= 2
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{
                                    width: `${Math.min(100, Math.max(5, (emp.paidLeavesUsed / emp.annualLeaveQuota) * 100))}%`,
                                  }}
                                />
                              </div>
                              {emp.unpaidLeavesUsed > 0 && (
                                <span className="text-[10px] text-rose-600 font-bold">
                                  +{emp.unpaidLeavesUsed} Unpaid (Deducted)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {emp.biometricPin ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1">
                                <Fingerprint size={12} /> PIN: {emp.biometricPin}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Not Assigned</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => openEditEmployeeModal(emp)}
                              className="px-2.5 py-1 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MONTHLY ATTENDANCE MATRIX                                          */}
        {/* ========================================================================= */}
        {activeTab === "monthly" && (
          <div className="space-y-6">
            {/* Month & Year Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Select Month:</span>
                <select
                  value={matrixMonth}
                  onChange={(e) => setMatrixMonth(parseInt(e.target.value, 10))}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {[
                    "January",
                    "February",
                    "March",
                    "April",
                    "May",
                    "June",
                    "July",
                    "August",
                    "September",
                    "October",
                    "November",
                    "December",
                  ].map((mName, idx) => (
                    <option key={mName} value={idx + 1}>
                      {mName}
                    </option>
                  ))}
                </select>

                <select
                  value={matrixYear}
                  onChange={(e) => setMatrixYear(parseInt(e.target.value, 10))}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {[2025, 2026, 2027, 2028].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color Legend */}
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500"></span> Present
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500"></span> Half Day
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-500"></span> Paid Leave
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-500"></span> Absent / Unpaid
                </span>
              </div>
            </div>

            {/* Matrix Grid Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-center text-xs">
                  <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 text-left sticky left-0 bg-slate-50 z-10 w-44">Employee</th>
                      {Array.from({ length: matrixDaysCount }, (_, i) => i + 1).map((day) => (
                        <th key={day} className="py-2 px-1.5 min-w-[28px]">
                          {day}
                        </th>
                      ))}
                      <th className="py-3 px-2 bg-emerald-50 text-emerald-800">Pres.</th>
                      <th className="py-3 px-2 bg-amber-50 text-amber-800">HD</th>
                      <th className="py-3 px-2 bg-blue-50 text-blue-800">Paid L</th>
                      <th className="py-3 px-2 bg-rose-50 text-rose-800">Unpaid</th>
                      <th className="py-3 px-2 bg-rose-100 text-rose-900 font-black">Deduct Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {matrixEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={matrixDaysCount + 6} className="py-8 text-center text-slate-400">
                          No records for this month.
                        </td>
                      </tr>
                    ) : (
                      matrixEmployees.map((emp) => (
                        <tr key={emp.employeeId} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 text-left font-bold text-slate-900 sticky left-0 bg-white z-10 whitespace-nowrap shadow-xs">
                            {emp.name}
                            <span className="text-[10px] text-slate-400 block font-normal">{emp.department}</span>
                          </td>

                          {/* Day 1..31 Status Chips */}
                          {Array.from({ length: matrixDaysCount }, (_, i) => i + 1).map((day) => {
                            const status = emp.dailyMap[day];
                            let cellClass = "bg-slate-50 text-slate-300";
                            let label = "-";

                            if (status === "PRESENT") {
                              cellClass = "bg-emerald-500 text-white font-bold";
                              label = "P";
                            } else if (status === "HALF_DAY") {
                              cellClass = "bg-amber-500 text-white font-bold";
                              label = "HD";
                            } else if (status === "PAID_LEAVE" || status === "LEAVE") {
                              cellClass = "bg-blue-500 text-white font-bold";
                              label = "L";
                            } else if (status === "UNPAID_LEAVE") {
                              cellClass = "bg-rose-500 text-white font-bold";
                              label = "UL";
                            } else if (status === "ABSENT") {
                              cellClass = "bg-rose-600 text-white font-bold";
                              label = "A";
                            }

                            return (
                              <td key={day} className="py-1 px-0.5">
                                <span className={`inline-block w-6 h-6 leading-6 rounded text-[10px] ${cellClass}`}>
                                  {label}
                                </span>
                              </td>
                            );
                          })}

                          {/* Summary Totals */}
                          <td className="py-2 px-2 font-bold text-emerald-700 bg-emerald-50/40">
                            {emp.summary.daysPresent}
                          </td>
                          <td className="py-2 px-2 font-bold text-amber-700 bg-amber-50/40">
                            {emp.summary.halfDays}
                          </td>
                          <td className="py-2 px-2 font-bold text-blue-700 bg-blue-50/40">
                            {emp.summary.paidLeaves}
                          </td>
                          <td className="py-2 px-2 font-bold text-rose-700 bg-rose-50/40">
                            {emp.summary.unpaidLeaves + emp.summary.absentDays}
                          </td>
                          <td className="py-2 px-2 font-black text-rose-700 bg-rose-100/40">
                            {emp.summary.deductionDays.toFixed(1)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: MONTHLY PAYROLL & AUTO-DEDUCTION ENGINE                            */}
        {/* ========================================================================= */}
        {activeTab === "payroll" && (
          <div className="space-y-6">
            {/* Header Controls */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Payroll Month:</span>
                  <select
                    value={payrollMonth}
                    onChange={(e) => setPayrollMonth(parseInt(e.target.value, 10))}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {[
                      "January",
                      "February",
                      "March",
                      "April",
                      "May",
                      "June",
                      "July",
                      "August",
                      "September",
                      "October",
                      "November",
                      "December",
                    ].map((mName, idx) => (
                      <option key={mName} value={idx + 1}>
                        {mName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={payrollYear}
                    onChange={(e) => setPayrollYear(parseInt(e.target.value, 10))}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {[2025, 2026, 2027, 2028].map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-xs text-slate-500 font-medium">Standard Working Days:</span>
                    <input
                      type="number"
                      value={payrollWorkingDays}
                      onChange={(e) => setPayrollWorkingDays(Math.max(1, parseInt(e.target.value, 10) || 26))}
                      className="w-16 bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 text-xs font-bold text-slate-900 text-center"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchPayroll}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                  Recalculate Sheet
                </button>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Gross Salaries</span>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    Rs. {payrollSummary.totalGrossPayroll.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Across {payrollSummary.totalEmployees} staff members</p>
                </div>

                <div className="bg-rose-50 border border-rose-200/80 p-4 rounded-xl">
                  <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Total Leave Deductions</span>
                  <p className="text-2xl font-black text-rose-700 mt-1">
                    -Rs. {payrollSummary.totalDeductions.toLocaleString()}
                  </p>
                  <p className="text-xs text-rose-600 mt-0.5">For excess unpaid leaves & absences</p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-xl">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Net Payable Payroll</span>
                  <p className="text-2xl font-black text-emerald-700 mt-1">
                    Rs. {payrollSummary.totalNetPayroll.toLocaleString()}
                  </p>
                  <p className="text-xs text-emerald-600 mt-0.5">To disburse this month</p>
                </div>
              </div>
            </div>

            {/* Payroll Sheet Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 font-bold">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Base Salary</th>
                      <th className="py-3 px-4">Daily Rate</th>
                      <th className="py-3 px-4">Present</th>
                      <th className="py-3 px-4">Paid Leaves</th>
                      <th className="py-3 px-4">Unpaid Excess</th>
                      <th className="py-3 px-4">Deduction (Rs.)</th>
                      <th className="py-3 px-4">Net Salary</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {payrollRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          No payroll data available.
                        </td>
                      </tr>
                    ) : (
                      payrollRows.map((row) => (
                        <tr key={row.employeeId} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {row.name}
                            <span className="text-[11px] text-slate-400 block font-normal">
                              {row.designation} • {row.department}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            Rs. {row.baseSalary.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 font-medium">
                            Rs. {row.dailyRate.toLocaleString()} / day
                          </td>
                          <td className="py-3.5 px-4 font-bold text-emerald-700">{row.daysPresent} days</td>
                          <td className="py-3.5 px-4 font-bold text-blue-700">{row.paidLeaves} days</td>
                          <td className="py-3.5 px-4">
                            {row.unpaidLeaves + row.absentDays > 0 ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                {row.unpaidLeaves + row.absentDays} days
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium">0</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-rose-700">
                            {row.deductionAmount > 0 ? `-Rs. ${row.deductionAmount.toLocaleString()}` : "Rs. 0"}
                          </td>
                          <td className="py-3.5 px-4 font-black text-sm text-emerald-800">
                            Rs. {row.netSalary.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4">
                            {row.slipStatus === "PAID" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                <CheckCircle2 size={12} /> PAID
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                <Clock size={12} /> PENDING
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {row.slipStatus === "PAID" ? (
                              <span className="text-xs text-slate-400 font-medium">
                                Paid via {row.paymentMethod || "cash"}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPayingEmployee(row)}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                Pay Salary
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: ADD / EDIT SALARIED EMPLOYEE                                        */}
        {/* ========================================================================= */}
        {showEmployeeModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    <UserCheck size={18} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    {editingEmployee ? "Edit Salaried Staff" : "Add Salaried Staff"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEmployee} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={employeeFormData.name}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, name: e.target.value })}
                      placeholder="e.g. Muhammad Rashid"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Designation */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Designation / Role <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={employeeFormData.designation}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, designation: e.target.value })}
                      placeholder="e.g. Cutting Master"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                    <select
                      value={employeeFormData.department}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, department: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {DEPARTMENTS.filter((d) => d !== "All").map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={employeeFormData.phone}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, phone: e.target.value })}
                      placeholder="e.g. 0300-1234567"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Monthly Base Salary */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Base Salary (Rs.) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="500"
                      value={employeeFormData.baseSalary}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, baseSalary: e.target.value })}
                      placeholder="e.g. 40000"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Annual Leave Quota */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Annual Leave Quota <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={employeeFormData.annualLeaveQuota}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, annualLeaveQuota: e.target.value })}
                      placeholder="e.g. 14"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Paid leaves authorized per year. Excess leaves are deducted.
                    </span>
                  </div>

                  {/* Biometric PIN */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Biometric Device PIN <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={employeeFormData.biometricPin}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, biometricPin: e.target.value })}
                      placeholder="e.g. 101"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Device User ID on fingerprint machine
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEmployeeModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
                  >
                    {editingEmployee ? "Update Employee" : "Create Employee"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: PAY SALARY CONFIRMATION                                            */}
        {/* ========================================================================= */}
        {payingEmployee && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    <DollarSign size={20} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">Confirm Salary Payout</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPayingEmployee(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 mb-5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Employee:</span>
                  <span className="font-bold text-slate-900">
                    {payingEmployee.name} ({payingEmployee.designation})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Month / Year:</span>
                  <span className="font-bold text-slate-900">
                    {payrollMonth}/{payrollYear}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Base Salary:</span>
                  <span className="font-bold text-slate-900">Rs. {payingEmployee.baseSalary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>Leave & Absence Deductions ({payingEmployee.deductionDays} days):</span>
                  <span>-Rs. {payingEmployee.deductionAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-emerald-800">
                  <span>Net Payable Amount:</span>
                  <span>Rs. {payingEmployee.netSalary.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Mode */}
              <div className="mb-5">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {["cash", "bank", "cheque"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMethod(mode)}
                      className={`py-2 rounded-xl text-xs font-bold uppercase transition border cursor-pointer ${
                        paymentMethod === mode
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPayingEmployee(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePaySalaryConfirm}
                  disabled={payingSalary}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {payingSalary ? "Processing..." : `Confirm & Pay Rs. ${payingEmployee.netSalary.toLocaleString()}`}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
