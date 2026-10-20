import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Organization from '@/models/Organization';
import ApprovedTarget from '@/models/ApprovedTarget';
import AssessmentProfile from '@/models/AssessmentProfile';
import AssessmentDocument from '@/models/AssessmentDocument';
import AuditLog from '@/models/AuditLog';
import User from '@/models/User';
import { getAuthSession, generateSessionToken, COOKIE_NAME, ROLES } from '@/lib/auth';
import { validateTargetUrl, validateLoginUrl, encryptCredential } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await connectToDatabase();
    const session = getAuthSession(request);
    const body = await request.json();

    const {
      // 1. Organization info
      name,
      legalEntityName,
      organizationType,
      industry,
      description,
      dpdpRegistrationNumber,
      contactDetails,
      privacyOfficer,
      grievanceOfficer,
      authorizedRepresentative,

      // 2. Website & features
      websiteUrl,
      websitePurpose,
      websiteFeatures,
      otherFeaturesDescription,

      // 3. Privacy documents
      privacyDocuments,

      // 4. Testing authorization & target scope
      approvedScope,
      excludedPaths,
      authorizationConfirmation,

      // 5. Assessment configuration
      assessmentMode,
      scopeSummary,
      loginWorkflowDetails,
      loginTestingConfig
    } = body;

    // --- Validation ---
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Organization name is required.' },
        { status: 400 }
      );
    }

    if (!websiteUrl || websiteUrl.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Primary website URL is required.' },
        { status: 400 }
      );
    }

    // SSRF Validation on target website URL
    const isDemoTarget = Boolean(body.isDemoSite || websiteUrl.includes(':4005'));
    const urlCheck = validateTargetUrl(websiteUrl, { allowDemoLocalhost: isDemoTarget });
    if (!urlCheck.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: `Website URL validation failed: ${urlCheck.reason}`,
          securityNotice: 'SSRF mitigation blocked target address.'
        },
        { status: 400 }
      );
    }

    // Explicit statutory authorization verification
    const isAuthorized =
      authorizationConfirmation === true ||
      authorizationConfirmation?.confirmed === true ||
      authorizedRepresentative?.confirmed === true;

    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: 'Explicit statutory authorization is required under the DPDP Act 2023.'
        },
        { status: 400 }
      );
    }

    // Validate document URLs for SSRF if provided
    if (Array.isArray(privacyDocuments)) {
      for (const doc of privacyDocuments) {
        if (doc.sourceType === 'url' && doc.url) {
          const docUrlCheck = validateTargetUrl(doc.url);
          if (!docUrlCheck.isValid) {
            return NextResponse.json(
              {
                success: false,
                error: `Document URL validation failed for "${doc.title || 'Document'}": ${docUrlCheck.reason}`
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // Validate login testing configuration if authenticated testing requested
    const loginCfg = loginTestingConfig || loginWorkflowDetails;
    if (loginCfg && loginCfg.enabled && !loginCfg.skipAuthenticatedTesting) {
      if (loginCfg.authMethod === 'password' || !loginCfg.authMethod) {
        if (!loginCfg.loginUrl || !loginCfg.loginUrl.trim()) {
          return NextResponse.json(
            { success: false, error: 'Login page URL is required when authenticated testing is enabled.' },
            { status: 400 }
          );
        }
        const loginCheck = validateLoginUrl(loginCfg.loginUrl, urlCheck.normalizedUrl, { allowDemoLocalhost: isDemoTarget });
        if (!loginCheck.isValid) {
          return NextResponse.json(
            { success: false, error: `Login URL validation failed: ${loginCheck.reason}` },
            { status: 400 }
          );
        }
        if (!loginCfg.username || !loginCfg.username.trim()) {
          return NextResponse.json(
            { success: false, error: 'Test account username or email is required for password-based login.' },
            { status: 400 }
          );
        }
        if (!loginCfg.password || !loginCfg.password.trim()) {
          return NextResponse.json(
            { success: false, error: 'Test account password is required for automated login testing.' },
            { status: 400 }
          );
        }
        if (loginCfg.authorizedConfirmation !== true) {
          return NextResponse.json(
            { success: false, error: 'Confirmation that credentials are authorized test accounts is required.' },
            { status: 400 }
          );
        }
      }
    }

    const userId = session?.userId || null;

    // 1. Locate existing Organization or create a new one
    let organization = null;
    const requestedOrgId = body.organizationId || session?.organizationId;
    if (requestedOrgId) {
      organization = await Organization.findById(requestedOrgId);
      if (organization) {
        // Ensure website is registered if not already present
        const websiteExists = organization.registeredWebsites?.some(
          (w) => w.url === urlCheck.normalizedUrl
        );
        if (!websiteExists) {
          if (!organization.registeredWebsites) organization.registeredWebsites = [];
          organization.registeredWebsites.push({
            name: `${name ? name.trim() : organization.name} Website`,
            url: urlCheck.normalizedUrl,
            purpose: websitePurpose,
            isAuthorized: true,
            authorizedAt: new Date(),
            authorizedBy: userId,
            scopeDescription: 'Authorized via comprehensive onboarding wizard'
          });
          await organization.save();
        }
      }
    }

    if (!organization) {
      organization = await Organization.create({
        name: name.trim(),
        legalEntityName: legalEntityName ? legalEntityName.trim() : name.trim(),
        organizationType: organizationType || 'Private Limited Company',
        industry: industry || 'SaaS & Cloud Services',
        description: description ? description.trim() : undefined,
        dpdpRegistrationNumber: dpdpRegistrationNumber ? dpdpRegistrationNumber.trim() : undefined,
        websiteUrl: urlCheck.normalizedUrl,
        websitePurpose: websitePurpose ? websitePurpose.trim() : undefined,
        contactDetails: {
          email: contactDetails?.email?.trim(),
          phone: contactDetails?.phone?.trim(),
          address: contactDetails?.address?.trim(),
          city: contactDetails?.city?.trim(),
          state: contactDetails?.state?.trim(),
          postalCode: contactDetails?.postalCode?.trim(),
          country: contactDetails?.country?.trim() || 'India'
        },
        privacyOfficer: {
          name: privacyOfficer?.name?.trim(),
          email: privacyOfficer?.email?.trim(),
          phone: privacyOfficer?.phone?.trim()
        },
        grievanceOfficer: {
          name: grievanceOfficer?.name?.trim(),
          email: grievanceOfficer?.email?.trim(),
          phone: grievanceOfficer?.phone?.trim(),
          physicalAddress: grievanceOfficer?.physicalAddress?.trim()
        },
        authorizedRepresentativeConfirmation: {
          confirmed: true,
          representativeName:
            authorizedRepresentative?.representativeName ||
            authorizationConfirmation?.confirmedByName ||
            'Authorized Representative',
          designation:
            authorizedRepresentative?.designation ||
            authorizationConfirmation?.confirmedByDesignation ||
            'Compliance Officer',
          confirmedAt: new Date()
        },
        registeredWebsites: [
          {
            name: `${name.trim()} Website`,
            url: urlCheck.normalizedUrl,
            purpose: websitePurpose,
            isAuthorized: true,
            authorizedAt: new Date(),
            authorizedBy: userId,
            scopeDescription: 'Authorized via comprehensive onboarding wizard'
          }
        ],
        status: 'active',
        createdBy: userId
      });
    }

    // 2. Find or Create ApprovedTarget
    let approvedTarget = await ApprovedTarget.findOne({
      organization: organization._id,
      approvedDomain: urlCheck.domain,
    });

    if (approvedTarget) {
      approvedTarget.targetUrl = urlCheck.normalizedUrl;
      approvedTarget.isDemoSite = isDemoTarget;
      approvedTarget.targetStatus = 'approved';
      if (Array.isArray(approvedScope) && approvedScope.length > 0) {
        approvedTarget.approvedScope = approvedScope;
      }
      if (Array.isArray(excludedPaths)) {
        approvedTarget.excludedPaths = excludedPaths;
      }
      await approvedTarget.save();
    } else {
      approvedTarget = await ApprovedTarget.create({
        organization: organization._id,
        approvedDomain: urlCheck.domain,
        targetUrl: urlCheck.normalizedUrl,
        isDemoSite: isDemoTarget,
        approvedScope: Array.isArray(approvedScope) && approvedScope.length > 0
          ? approvedScope
          : [
              'public_pages',
              'cookie_consent_banners',
              'tracking_scripts',
              'privacy_policy',
              'grievance_contact_verification'
            ],
        excludedPaths: Array.isArray(excludedPaths) ? excludedPaths : ['/admin', '/internal'],
        authorizationConfirmation: {
          confirmed: true,
          confirmedBy: userId,
          confirmedByName:
            authorizationConfirmation?.confirmedByName ||
            authorizedRepresentative?.representativeName ||
            'Authorized Assessor',
          confirmedByDesignation:
            authorizationConfirmation?.confirmedByDesignation ||
            authorizedRepresentative?.designation ||
            'Officer',
          confirmedAt: new Date()
        },
        targetStatus: 'approved',
        ssrfValidated: true,
        ssrfValidatedAt: new Date(),
        createdBy: userId
      });
    }

    // 3. Find or Create AssessmentProfile
    const finalLoginWorkflowDetails = loginCfg ? {
      hasAuthTesting: Boolean(loginCfg.enabled && !loginCfg.skipAuthenticatedTesting && (loginCfg.authMethod === 'password' || !loginCfg.authMethod)),
      authMethod: loginCfg.skipAuthenticatedTesting ? 'public_only' : (loginCfg.authMethod || (loginCfg.enabled ? 'password' : 'public_only')),
      loginUrl: loginCfg.loginUrl ? loginCfg.loginUrl.trim() : undefined,
      testUsername: loginCfg.username ? loginCfg.username.trim() : undefined,
      encryptedPassword: loginCfg.password ? encryptCredential(loginCfg.password) : undefined,
      skipAuthenticatedTesting: Boolean(loginCfg.skipAuthenticatedTesting || !loginCfg.enabled),
      authorizedConfirmation: Boolean(loginCfg.authorizedConfirmation),
      instructions: loginCfg.instructions ? loginCfg.instructions.trim() : undefined,
    } : undefined;

    let profile = await AssessmentProfile.findOne({
      organization: organization._id,
      approvedTarget: approvedTarget._id,
    });

    if (profile) {
      profile.websiteUrl = urlCheck.normalizedUrl;
      profile.websitePurpose = websitePurpose;
      if (Array.isArray(websiteFeatures)) profile.websiteFeatures = websiteFeatures;
      if (otherFeaturesDescription) profile.otherFeaturesDescription = otherFeaturesDescription.trim();
      profile.assessmentMode = assessmentMode || (finalLoginWorkflowDetails?.hasAuthTesting ? 'authorized_login_testing' : 'website_with_documents');
      profile.loginWorkflowDetails = finalLoginWorkflowDetails;
      profile.status = 'ready_for_assessment';
      await profile.save();
    } else {
      profile = await AssessmentProfile.create({
        organization: organization._id,
        approvedTarget: approvedTarget._id,
        websiteUrl: urlCheck.normalizedUrl,
        websitePurpose: websitePurpose,
        websiteFeatures: Array.isArray(websiteFeatures) ? websiteFeatures : [],
        otherFeaturesDescription: otherFeaturesDescription?.trim() || undefined,
        assessmentMode: assessmentMode || (finalLoginWorkflowDetails?.hasAuthTesting ? 'authorized_login_testing' : 'website_with_documents'),
        loginWorkflowDetails: finalLoginWorkflowDetails,
        scopeSummary:
          scopeSummary ||
          `Assessment for ${organization.name} on ${urlCheck.domain} covering ${
            Array.isArray(websiteFeatures) ? websiteFeatures.filter((f) => f.enabled).length : 0
          } enabled website modules.`,
        status: 'ready_for_assessment',
        createdBy: userId
      });
    }

    // 4. Save Privacy Documents if supplied
    const savedDocs = [];
    if (Array.isArray(privacyDocuments) && privacyDocuments.length > 0) {
      for (const doc of privacyDocuments) {
        if ((doc.sourceType === 'url' && doc.url) || (doc.sourceType === 'upload' && (doc.extractedText || doc.fileName))) {
          const createdDoc = await AssessmentDocument.create({
            organization: organization._id,
            documentType: doc.documentType || 'privacy_policy',
            title: doc.title || `${doc.documentType} Document`,
            sourceType: doc.sourceType,
            url: doc.url || undefined,
            fileName: doc.fileName || undefined,
            mimeType: doc.mimeType || 'text/plain',
            sizeBytes: doc.sizeBytes || (doc.extractedText ? doc.extractedText.length : 0),
            extractedText: doc.extractedText || undefined,
            textLength: doc.extractedText ? doc.extractedText.length : 0,
            uploadedBy: userId
          });
          savedDocs.push(createdDoc);
        }
      }
    }

    // 5. Update user's organization if logged in
    if (userId) {
      await User.findByIdAndUpdate(userId, {
        organization: organization._id,
        role: session?.role === ROLES.USER ? ROLES.ORGANIZATION_OWNER : session?.role
      });
    }

    // 6. Log Comprehensive Audit Trail
    await AuditLog.create({
      action: 'ORGANIZATION_ONBOARDED',
      category: 'organization',
      actor: {
        userId,
        email: session?.email || contactDetails?.email || 'onboarding@dpdp.local'
      },
      target: {
        entityType: 'Organization',
        entityId: organization._id,
        identifier: organization.name
      },
      details: {
        domain: urlCheck.domain,
        approvedTargetId: approvedTarget._id,
        profileId: profile._id,
        documentsCount: savedDocs.length,
        featuresCount: Array.isArray(websiteFeatures) ? websiteFeatures.filter((f) => f.enabled).length : 0
      },
      status: 'success'
    });

    const response = NextResponse.json(
      {
        success: true,
        data: {
          organization,
          approvedTarget,
          profile,
          documentsCount: savedDocs.length
        }
      },
      { status: 201 }
    );

    if (userId) {
      const updatedUser = await User.findById(userId);
      if (updatedUser) {
        const freshToken = generateSessionToken(updatedUser);
        response.cookies.set(COOKIE_NAME, freshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60
        });
      }
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
