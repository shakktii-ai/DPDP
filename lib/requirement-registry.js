import LegalRequirement from '../models/LegalRequirement.js';
import connectDB from './mongodb.js';

export const OFFICIAL_LEGAL_REQUIREMENTS = [
  {
    requirementId: 'DPDP-ACT-SEC-5-NOTICE',
    officialSource: 'Digital Personal Data Protection Act, 2023',
    sectionOrRule: 'Section 5(1)',
    title: 'Pre-Consent Itemized Privacy Notice Disclosures',
    version: '2023.1',
    effectiveDate: '2023-08-11',
    isCurrentlyEnforceable: true,
    category: 'Notice & Consent',
    applicabilityConditions: ['public_pages', 'contact_forms', 'user_registration_login'],
    expectedControl: 'Notice given to Data Principal at or before requesting consent declaring specified personal data collected, processing purpose, exercise of rights under Sec 11, 12, 13, and Grievance Officer details.',
    assessmentMethod: 'automated_browser',
    requiredEvidence: 'Screenshot of privacy notice and extracted text confirming 5 core disclosures.',
    reviewerGuidance: 'Check that notice is not bundled into lengthy Terms of Service without dedicated itemized notice.',
    defaultSeverity: 'critical',
  },
  {
    requirementId: 'DPDP-ACT-SEC-6-CONSENT-ITEMIZED',
    officialSource: 'Digital Personal Data Protection Act, 2023',
    sectionOrRule: 'Section 6(1)',
    title: 'Free, Specific, Informed, Unconditional & Unambiguous Consent',
    version: '2023.1',
    effectiveDate: '2023-08-11',
    isCurrentlyEnforceable: true,
    category: 'Notice & Consent',
    applicabilityConditions: ['contact_forms', 'cookies_analytics', 'user_registration_login', 'newsletter_subscriptions'],
    expectedControl: 'Consent must be indicated through clear affirmative action with itemized purpose options. No pre-ticked checkboxes or deceptive dark patterns.',
    assessmentMethod: 'automated_browser',
    requiredEvidence: 'DOM inspection and screenshot showing unchecked default state and affirmative consent action.',
    reviewerGuidance: 'Pre-ticked consent checkboxes violate Section 6(1). Checkbox must require positive user click.',
    defaultSeverity: 'high',
  },
  {
    requirementId: 'DPDP-ACT-SEC-6-WITHDRAWAL',
    officialSource: 'Digital Personal Data Protection Act, 2023',
    sectionOrRule: 'Section 6(4)',
    title: 'Right & Comparable Ease of Consent Withdrawal',
    version: '2023.1',
    effectiveDate: '2023-08-11',
    isCurrentlyEnforceable: true,
    category: 'Data Principal Rights',
    applicabilityConditions: ['cookies_analytics', 'user_profiles', 'newsletter_subscriptions'],
    expectedControl: 'Data Principal has the unconditional right to withdraw consent with ease comparable to the ease with which consent was given.',
    assessmentMethod: 'hybrid',
    requiredEvidence: 'Cookie banner opt-out toggle, consent preference dashboard, or direct withdrawal interface.',
    reviewerGuidance: 'If consent was given via a 1-click banner, withdrawal must not require mailing physical letters or navigating convoluted menus.',
    defaultSeverity: 'high',
  },
  {
    requirementId: 'DPDP-ACT-SEC-8-5-SECURITY-SAFEGUARDS',
    officialSource: 'Digital Personal Data Protection Act, 2023',
    sectionOrRule: 'Section 8(5)',
    title: 'Reasonable Security Safeguards Against Data Breaches',
    version: '2023.1',
    effectiveDate: '2023-08-11',
    isCurrentlyEnforceable: true,
    category: 'Security Safeguards',
    applicabilityConditions: ['user_registration_login', 'payments', 'contact_forms'],
    expectedControl: 'Implementation of reasonable technical and organizational safeguards including HTTPS encryption, masked password fields, CSRF defense, and secure session management.',
    assessmentMethod: 'automated_browser',
    requiredEvidence: 'SSL/TLS cipher validation, password masking in DOM, and secure cookie attributes.',
    reviewerGuidance: 'Verify form submission endpoint uses HTTPS and credentials are not submitted via unencrypted GET queries.',
    defaultSeverity: 'critical',
  },
  {
    requirementId: 'DPDP-ACT-SEC-8-7-RETENTION-ERASURE',
    officialSource: 'Digital Personal Data Protection Act, 2023',
    sectionOrRule: 'Section 8(7)',
    title: 'Personal Data Retention Limitations & Erasure Workflows',
    version: '2023.1',
    effectiveDate: '2023-08-11',
    isCurrentlyEnforceable: true,
    category: 'Data Fiduciary Obligations',
    applicabilityConditions: ['user_profiles', 'account_deletion_data_requests'],
    expectedControl: 'Personal data must be erased as soon as it is reasonable to assume that the specified purpose is no longer served or consent is withdrawn.',
    assessmentMethod: 'hybrid',
    requiredEvidence: 'Documented statutory retention schedule in Privacy Policy and account deletion workflow.',
    reviewerGuidance: 'Check if privacy policy states an explicit retention period or indefinite indefinite storage.',
    defaultSeverity: 'medium',
  },
  {
    requirementId: 'DPDP-ACT-SEC-8-9-GRIEVANCE-OFFICER',
    officialSource: 'Digital Personal Data Protection Act, 2023',
    sectionOrRule: 'Section 8(9)',
    title: 'Statutory Grievance Redressal Mechanism & Officer Publication',
    version: '2023.1',
    effectiveDate: '2023-08-11',
    isCurrentlyEnforceable: true,
    category: 'Grievance Redressal Mechanism',
    applicabilityConditions: ['public_pages'],
    expectedControl: 'Publication of the name, official email/electronic channel, and office address of the designated Grievance Officer, with response SLA.',
    assessmentMethod: 'automated_browser',
    requiredEvidence: 'Dedicated /grievance page or privacy notice section displaying officer identity and contact channels.',
    reviewerGuidance: 'Generic support emails (support@company.com) without designated officer name do not satisfy Section 8(9).',
    defaultSeverity: 'critical',
  },
  {
    requirementId: 'DPDP-ACT-SEC-9-CHILDREN-DATA',
    officialSource: 'Digital Personal Data Protection Act, 2023',
    sectionOrRule: 'Section 9(1)',
    title: 'Verifiable Parental Consent for Processing of Children Personal Data',
    version: '2023.1',
    effectiveDate: '2023-08-11',
    isCurrentlyEnforceable: true,
    category: 'Children Data Protection',
    applicabilityConditions: ['user_registration_login'],
    expectedControl: 'Obtain verifiable parental consent prior to processing digital personal data of an individual under 18 years of age. Prohibition of targeted behavioral tracking.',
    assessmentMethod: 'manual_verification',
    requiredEvidence: 'Age gate interface and parental verification mechanism in registration workflow.',
    reviewerGuidance: 'If the service does not target minors, evaluate whether general registration excludes minors or requires parental consent.',
    defaultSeverity: 'high',
  },
  {
    requirementId: 'DPDP-RULES-2025-RULE-3-NOTICE-FORMAT',
    officialSource: 'Digital Personal Data Protection Rules, 2025',
    sectionOrRule: 'Rule 3',
    title: 'Multi-Lingual Notice Accessibility (8th Schedule Languages)',
    version: '2025.1',
    effectiveDate: '2025-01-01',
    isCurrentlyEnforceable: true,
    category: 'Notice & Consent',
    applicabilityConditions: ['public_pages'],
    expectedControl: 'Notice must be easily comprehensible, presented in clear language, and offer options in English and Indian languages specified in the 8th Schedule.',
    assessmentMethod: 'automated_browser',
    requiredEvidence: 'Language selector on notice or multi-lingual translated notice availability.',
    reviewerGuidance: 'Check if notice provides accessible language switching options.',
    defaultSeverity: 'medium',
  },
  {
    requirementId: 'DPDP-RULES-2025-RULE-5-CONSENT-MANAGERS',
    officialSource: 'Digital Personal Data Protection Rules, 2025',
    sectionOrRule: 'Rule 5',
    title: 'Interoperability with Registered Consent Managers',
    version: '2025.1',
    effectiveDate: '2025-01-01',
    isCurrentlyEnforceable: true,
    category: 'Data Principal Rights',
    applicabilityConditions: ['cookies_analytics', 'third_party_integrations'],
    expectedControl: 'Support for interoperable consent management allowing Data Principals to manage consent through registered Consent Managers.',
    assessmentMethod: 'document_review',
    requiredEvidence: 'Consent architecture documentation or API integration spec.',
    reviewerGuidance: 'Verify if consent tokens support revocation hooks or consent manager federation.',
    defaultSeverity: 'low',
  },
];

/**
 * Seeds or updates the authoritative Legal Requirements registry in MongoDB.
 */
export async function seedLegalRequirements() {
  await connectDB();
  for (const req of OFFICIAL_LEGAL_REQUIREMENTS) {
    await LegalRequirement.findOneAndUpdate(
      { requirementId: req.requirementId },
      { $set: req },
      { upsert: true, new: true }
    );
  }
}

/**
 * Determines which legal requirements apply based on organization profile & website features.
 * 
 * @param {object} organization - Organization document
 * @param {object} assessmentProfile - AssessmentProfile document or websiteCapabilities
 * @returns {Array<{ requirement: object, isApplicable: boolean, reason: string }>}
 */
export function evaluateApplicability(organization, assessmentProfile = null) {
  let profileFeatures = assessmentProfile?.websiteCapabilities || {};

  // If websiteFeatures array is present (from AssessmentProfile model)
  if (Array.isArray(assessmentProfile?.websiteFeatures)) {
    const map = { ...profileFeatures };
    for (const f of assessmentProfile.websiteFeatures) {
      if (f.enabled) {
        map[f.key] = true;
      }
    }
    profileFeatures = map;
  }

  // Normalize aliases between onboarding wizard form keys and legal requirement trigger keys
  const normalizedFeatures = { ...profileFeatures };
  if (profileFeatures.registration_login || profileFeatures.user_account_creation_login) {
    normalizedFeatures.user_registration_login = true;
  }
  if (profileFeatures.newsletter_marketing) {
    normalizedFeatures.newsletter_subscriptions = true;
  }
  if (profileFeatures.account_deletion_data_request) {
    normalizedFeatures.account_deletion_data_requests = true;
  }
  if (profileFeatures.user_registration_login) {
    normalizedFeatures.registration_login = true;
  }

  return OFFICIAL_LEGAL_REQUIREMENTS.map((req) => {
    // If requirement has no specific triggers, it applies to all Data Fiduciaries
    if (!req.applicabilityConditions || req.applicabilityConditions.length === 0) {
      return {
        requirement: req,
        isApplicable: true,
        reason: 'Universal Data Fiduciary obligation under the DPDP Act 2023.',
      };
    }

    // Check if any applicability condition is active
    const activeMatches = req.applicabilityConditions.filter((cond) => {
      if (cond === 'public_pages') return true; // All websites have public pages
      return Boolean(normalizedFeatures[cond]);
    });

    if (activeMatches.length > 0) {
      return {
        requirement: req,
        isApplicable: true,
        reason: `Triggered by active website capabilities: ${activeMatches.join(', ')}`,
      };
    }

    return {
      requirement: req,
      isApplicable: false,
      reason: `Website does not feature triggers: ${req.applicabilityConditions.join(', ')}`,
    };
  });
}
