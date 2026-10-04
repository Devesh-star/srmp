import { ControlSeed } from "./types";

export const controls: ControlSeed[] = [
  {
    id: "ctl_rate_limiting",
    name: "Rate Limiting",
    category: "Technical",
    description: "Restricts the number of requests a user can make in a given timeframe.",
    effectiveness: 0.20,
    reduces: "likelihood",
    implementationCost: "Medium"
  },
  {
    id: "ctl_mfa",
    name: "Multi-Factor Authentication",
    category: "Technical",
    description: "Requires multiple pieces of evidence to authenticate users.",
    effectiveness: 0.25,
    reduces: "likelihood",
    implementationCost: "Medium"
  },
  {
    id: "ctl_input_validation",
    name: "Input Validation / Parameterized Queries",
    category: "Technical",
    description: "Ensures all user input is properly sanitized and parameters are used in database queries.",
    effectiveness: 0.45,
    reduces: "likelihood",
    implementationCost: "Medium"
  },
  {
    id: "ctl_edr",
    name: "Endpoint Detection and Response",
    category: "Technical",
    description: "Monitors endpoints for suspicious activity and blocks known malware signatures.",
    effectiveness: 0.40,
    reduces: "likelihood",
    implementationCost: "High"
  },
  {
    id: "ctl_offline_backup",
    name: "Offline Backup",
    category: "Administrative",
    description: "Maintains disconnected, immutable copies of critical data.",
    effectiveness: 0.45,
    reduces: "impact",
    implementationCost: "Medium"
  },
  {
    id: "ctl_db_encryption",
    name: "Database Encryption",
    category: "Technical",
    description: "Encrypts sensitive data at rest in databases.",
    effectiveness: 0.20,
    reduces: "impact",
    implementationCost: "Medium"
  },
  {
    id: "ctl_rbac",
    name: "Role-Based Access Control",
    category: "Technical",
    description: "Assigns permissions based on user roles and least privilege principles.",
    effectiveness: 0.30,
    reduces: "likelihood",
    implementationCost: "Medium"
  },
  {
    id: "ctl_network_segmentation",
    name: "Network Segmentation",
    category: "Technical",
    description: "Divides the network into isolated subnets to contain lateral movement.",
    effectiveness: 0.30,
    reduces: "impact",
    implementationCost: "High"
  },
  {
    id: "ctl_patch_management",
    name: "Patch Management",
    category: "Administrative",
    description: "Systematically applies software and security updates.",
    effectiveness: 0.40,
    reduces: "likelihood",
    implementationCost: "Medium"
  },
  {
    id: "ctl_access_monitoring",
    name: "Access Monitoring",
    category: "Technical",
    description: "Logs and reviews access patterns for anomalies.",
    effectiveness: 0.10,
    reduces: "likelihood",
    implementationCost: "Low"
  },
  {
    id: "ctl_security_awareness",
    name: "Security Awareness Training",
    category: "Administrative",
    description: "Educates employees and students on identifying security threats like phishing.",
    effectiveness: 0.15,
    reduces: "likelihood",
    implementationCost: "Low"
  },
  {
    id: "ctl_waf",
    name: "Web Application Firewall",
    category: "Technical",
    description: "Filters and monitors HTTP traffic to web applications.",
    effectiveness: 0.35,
    reduces: "likelihood",
    implementationCost: "High"
  },
  {
    id: "ctl_password_policy",
    name: "Password Policy",
    category: "Administrative",
    description: "Enforces strong password complexity, length, and expiration rules.",
    effectiveness: 0.15,
    reduces: "likelihood",
    implementationCost: "Low"
  },
  {
    id: "ctl_tls_enforcement",
    name: "TLS Enforcement",
    category: "Technical",
    description: "Ensures all network communication is encrypted in transit.",
    effectiveness: 0.30,
    reduces: "likelihood",
    implementationCost: "Low"
  },
  {
    id: "ctl_physical_access_control",
    name: "Physical Access Control",
    category: "Physical",
    description: "Secures sensitive facilities using keycards and biometric scanners.",
    effectiveness: 0.40,
    reduces: "likelihood",
    implementationCost: "High"
  },
  {
    id: "ctl_ups_generator",
    name: "UPS and Backup Generators",
    category: "Physical",
    description: "Provides temporary and sustained power during outages.",
    effectiveness: 0.45,
    reduces: "impact",
    implementationCost: "High"
  },
  {
    id: "ctl_incident_response_plan",
    name: "Incident Response Plan",
    category: "Administrative",
    description: "Establishes a documented process for handling security breaches.",
    effectiveness: 0.20,
    reduces: "impact",
    implementationCost: "Medium"
  },
  {
    id: "ctl_vendor_risk_review",
    name: "Vendor Risk Review",
    category: "Administrative",
    description: "Assesses third-party suppliers for security compliance.",
    effectiveness: 0.15,
    reduces: "likelihood",
    implementationCost: "Low"
  },
  {
    id: "ctl_secrets_rotation",
    name: "Secrets Rotation",
    category: "Technical",
    description: "Automatically changes API keys and service passwords periodically.",
    effectiveness: 0.25,
    reduces: "likelihood",
    implementationCost: "Medium"
  },
  {
    id: "ctl_device_management",
    name: "Mobile Device Management (MDM)",
    category: "Technical",
    description: "Enforces security policies on mobile devices and laptops.",
    effectiveness: 0.25,
    reduces: "likelihood",
    implementationCost: "Medium"
  }
];
