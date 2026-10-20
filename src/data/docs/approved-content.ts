import { adaptDocumentationRecords, type DocumentationRecord } from '@/lib/docs/content';

// No production article is published until its content and review metadata are approved.
export const APPROVED_DOCUMENTATION_RECORDS: readonly DocumentationRecord[] = [];
export const DOCUMENTATION_ARTICLES = adaptDocumentationRecords(APPROVED_DOCUMENTATION_RECORDS);