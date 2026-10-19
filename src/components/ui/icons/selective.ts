/**
 * UI-FE-089 — Selective (tree-shakeable) icon imports
 *
 * Consumers that render a single, statically-known approved icon should import
 * it from here:
 *
 * ```tsx
 * import { ShieldCheckIcon } from '@/components/ui/icons/selective';
 * ```
 *
 * Unlike the dynamic `<Icon name=… />` path, this module only references the
 * individual glyphs that are imported, so the rest of the registry is
 * tree-shaken out of the bundle. Every export is an approved catalogue glyph.
 */

export {
  AlertCircle as AlertIcon,
  AlertTriangle as AlertTriangleIcon,
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  ArrowUpRight as ArrowUpRightIcon,
  Ban as BanIcon,
  Calendar as CalendarIcon,
  Check as CheckIcon,
  CheckCheck as CheckCheckIcon,
  CheckCircle2 as CheckCircleIcon,
  Clock as ClockIcon,
  Copy as CopyIcon,
  Database as DatabaseIcon,
  Download as DownloadIcon,
  ExternalLink as ExternalLinkIcon,
  FileCheck as FileCheckIcon,
  FileText as FileTextIcon,
  Gauge as GaugeIcon,
  HelpCircle as HelpIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  KeyRound as KeyIcon,
  Layers as LayersIcon,
  Link as LinkIcon,
  ListChecks as ListChecksIcon,
  Loader2 as LoaderIcon,
  Lock as LockIcon,
  LogIn as LogInIcon,
  LogOut as LogOutIcon,
  Monitor as MonitorIcon,
  Moon as MoonIcon,
  Plus as PlusIcon,
  RefreshCw as RefreshIcon,
  RotateCcw as RotateCcwIcon,
  Scale as ScaleIcon,
  Settings as SettingsIcon,
  Shield as ShieldIcon,
  ShieldAlert as ShieldAlertIcon,
  ShieldCheck as ShieldCheckIcon,
  Sparkles as SparklesIcon,
  Sun as SunIcon,
  Tag as TagIcon,
  ThumbsDown as ThumbsDownIcon,
  ThumbsUp as ThumbsUpIcon,
  Undo2 as UndoIcon,
  Users as UsersIcon,
  Wallet as WalletIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  X as XIcon,
  XCircle as XCircleIcon,
  Zap as ZapIcon,
} from 'lucide-react';
