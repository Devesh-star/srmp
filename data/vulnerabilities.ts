import { VulnerabilitySeed } from "./types";

export const vulnerabilities: VulnerabilitySeed[] = [
  {
    id: "vul_weak_authentication",
    name: "Weak Authentication",
    description: "Authentication mechanisms are easily bypassed or rely on weak factors.",
    severity: "High",
    applicableAssetTypes: ["Web Application", "Mobile Application", "API", "Server"],
    recommendedControlIds: ["ctl_password_policy", "ctl_mfa"]
  },
  {
    id: "vul_missing_mfa",
    name: "Missing MFA",
    description: "User accounts are protected only by a single factor, such as a password.",
    severity: "High",
    applicableAssetTypes: ["Web Application", "API", "Cloud Resource", "Server"],
    recommendedControlIds: ["ctl_mfa"]
  },
  {
    id: "vul_unpatched_software",
    name: "Unpatched Software",
    description: "Operating systems or applications have known, unapplied security updates.",
    severity: "Critical",
    applicableAssetTypes: ["Server", "Laptop", "Network Device"],
    recommendedControlIds: ["ctl_patch_management", "ctl_edr"]
  },
  {
    id: "vul_poor_input_validation",
    name: "Poor Input Validation",
    description: "The application does not properly sanitize user inputs, leading to injection flaws.",
    severity: "High",
    applicableAssetTypes: ["Web Application", "API"],
    recommendedControlIds: ["ctl_input_validation", "ctl_waf"]
  },
  {
    id: "vul_weak_access_control",
    name: "Weak Access Control",
    description: "Permissions are too broad and bypass authorization checks.",
    severity: "High",
    applicableAssetTypes: ["Database", "Web Application", "API", "Document"],
    recommendedControlIds: ["ctl_rbac", "ctl_mfa", "ctl_access_monitoring", "ctl_db_encryption"]
  },
  {
    id: "vul_publicly_exposed_database",
    name: "Publicly Exposed Database",
    description: "The database service is reachable from the public internet.",
    severity: "Critical",
    applicableAssetTypes: ["Database", "Cloud Resource"],
    recommendedControlIds: ["ctl_network_segmentation"]
  },
  {
    id: "vul_weak_encryption",
    name: "Weak Encryption",
    description: "Use of outdated cryptographic algorithms or unencrypted protocols.",
    severity: "Medium",
    applicableAssetTypes: ["Network Device", "Web Application", "Database"],
    recommendedControlIds: ["ctl_tls_enforcement", "ctl_db_encryption"]
  },
  {
    id: "vul_default_credentials",
    name: "Default Credentials",
    description: "Systems or applications are using vendor-supplied default passwords.",
    severity: "Critical",
    applicableAssetTypes: ["Network Device", "Server", "Physical Equipment"],
    recommendedControlIds: ["ctl_password_policy", "ctl_secrets_rotation"]
  },
  {
    id: "vul_no_backup",
    name: "No Backup",
    description: "Critical data is not regularly backed up or backups are not isolated.",
    severity: "High",
    applicableAssetTypes: ["Database", "Server", "Document"],
    recommendedControlIds: ["ctl_offline_backup"]
  },
  {
    id: "vul_poor_network_segmentation",
    name: "Poor Network Segmentation",
    description: "Flat network architecture allows unrestrained lateral movement.",
    severity: "High",
    applicableAssetTypes: ["Network Device", "Server", "Cloud Resource"],
    recommendedControlIds: ["ctl_network_segmentation"]
  },
  {
    id: "vul_excessive_privileges",
    name: "Excessive Privileges",
    description: "Users or services have permissions beyond what they strictly need.",
    severity: "Medium",
    applicableAssetTypes: ["Web Application", "Cloud Resource", "Database"],
    recommendedControlIds: ["ctl_rbac"]
  },
  {
    id: "vul_insecure_api",
    name: "Insecure API",
    description: "API endpoints are unauthenticated or susceptible to abuse.",
    severity: "High",
    applicableAssetTypes: ["API", "Web Application", "Mobile Application"],
    recommendedControlIds: ["ctl_rate_limiting", "ctl_waf", "ctl_mfa"]
  },
  {
    id: "vul_no_logging_monitoring",
    name: "No Logging or Monitoring",
    description: "System logs are not collected, making threat detection difficult.",
    severity: "Medium",
    applicableAssetTypes: ["Server", "Network Device", "Database", "API"],
    recommendedControlIds: ["ctl_access_monitoring", "ctl_edr"]
  },
  {
    id: "vul_no_security_awareness",
    name: "No Security Awareness Training",
    description: "Users are unaware of common cybersecurity threats such as phishing.",
    severity: "Medium",
    applicableAssetTypes: ["Laptop", "Document"],
    recommendedControlIds: ["ctl_security_awareness"]
  },
  {
    id: "vul_unencrypted_wifi",
    name: "Unencrypted Wi-Fi",
    description: "Wireless networks broadcast data without strong encryption.",
    severity: "High",
    applicableAssetTypes: ["Network Device", "Mobile Application", "Laptop"],
    recommendedControlIds: ["ctl_tls_enforcement", "ctl_network_segmentation"]
  },
  {
    id: "vul_unmanaged_personal_devices",
    name: "Unmanaged Personal Devices",
    description: "Personal BYOD devices connect to the internal network without compliance checks.",
    severity: "Medium",
    applicableAssetTypes: ["Laptop", "Mobile Application"],
    recommendedControlIds: ["ctl_device_management", "ctl_network_segmentation"]
  },
  {
    id: "vul_no_physical_access_control",
    name: "No Physical Access Control",
    description: "Anyone can walk into sensitive areas such as server rooms.",
    severity: "High",
    applicableAssetTypes: ["Physical Equipment", "Server", "Network Device"],
    recommendedControlIds: ["ctl_physical_access_control"]
  },
  {
    id: "vul_no_incident_response_plan",
    name: "No Incident Response Plan",
    description: "Lack of a structured procedure to respond to security incidents.",
    severity: "Medium",
    applicableAssetTypes: ["Server", "Database", "Cloud Resource"],
    recommendedControlIds: ["ctl_incident_response_plan"]
  },
  {
    id: "vul_no_vendor_review",
    name: "No Vendor or Third-Party Review",
    description: "Third-party services are integrated without security assessments.",
    severity: "Low",
    applicableAssetTypes: ["Cloud Resource", "API"],
    recommendedControlIds: ["ctl_vendor_risk_review"]
  },
  {
    id: "vul_no_power_backup",
    name: "No Power Backup",
    description: "Critical hardware lacks uninterruptible power supplies or generators.",
    severity: "High",
    applicableAssetTypes: ["Physical Equipment", "Server", "Network Device"],
    recommendedControlIds: ["ctl_ups_generator"]
  }
];
