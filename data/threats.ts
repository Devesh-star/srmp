import { ThreatSeed } from "./types";

export const threats: ThreatSeed[] = [
  {
    id: "thr_phishing",
    name: "Phishing",
    category: "Human",
    description: "Deceptive emails designed to trick users into revealing credentials.",
    potentialImpact: "Leads to unauthorized access and potential data exfiltration.",
    ciaTarget: "C",
    applicableAssetTypes: ["Laptop", "Web Application", "Document"],
    vulnerabilityIds: ["vul_no_security_awareness", "vul_weak_authentication"]
  },
  {
    id: "thr_ransomware",
    name: "Ransomware",
    category: "Cyber",
    description: "Malicious software that encrypts data and demands payment for the decryption key.",
    potentialImpact: "Causes severe operational downtime and data loss.",
    ciaTarget: "A",
    applicableAssetTypes: ["Server", "Laptop", "Database", "Document"],
    vulnerabilityIds: ["vul_unpatched_software", "vul_no_backup", "vul_poor_network_segmentation"]
  },
  {
    id: "thr_malware",
    name: "Malware",
    category: "Cyber",
    description: "Viruses, worms, and trojans that infect systems to cause harm.",
    potentialImpact: "Compromises system integrity and performance.",
    ciaTarget: "I",
    applicableAssetTypes: ["Laptop", "Server", "Mobile Application"],
    vulnerabilityIds: ["vul_unpatched_software", "vul_unmanaged_personal_devices"]
  },
  {
    id: "thr_ddos",
    name: "Distributed Denial of Service (DDoS)",
    category: "Cyber",
    description: "Overwhelms systems or networks with a flood of internet traffic.",
    potentialImpact: "Makes services unavailable to legitimate users.",
    ciaTarget: "A",
    applicableAssetTypes: ["Web Application", "Server", "API", "Network Device"],
    vulnerabilityIds: ["vul_insecure_api", "vul_poor_network_segmentation"]
  },
  {
    id: "thr_sql_injection",
    name: "SQL Injection",
    category: "Cyber",
    description: "Attacker executes malicious SQL statements to manipulate database data.",
    potentialImpact: "Allows unauthorized viewing or modifying of database contents.",
    ciaTarget: "C",
    applicableAssetTypes: ["Database", "Web Application"],
    vulnerabilityIds: ["vul_poor_input_validation"]
  },
  {
    id: "thr_credential_theft",
    name: "Credential Theft",
    category: "Human",
    description: "Stealing usernames and passwords through various attack vectors.",
    potentialImpact: "Results in unauthorized access to university systems.",
    ciaTarget: "C",
    applicableAssetTypes: ["Web Application", "Mobile Application", "API"],
    vulnerabilityIds: ["vul_missing_mfa", "vul_weak_encryption"]
  },
  {
    id: "thr_insider_threat",
    name: "Insider Threat",
    category: "Human",
    description: "Malicious or negligent actions by current or former students, staff, or faculty.",
    potentialImpact: "Can result in data destruction or intellectual property theft.",
    ciaTarget: "C",
    applicableAssetTypes: ["Document", "Database", "Physical Equipment"],
    vulnerabilityIds: ["vul_excessive_privileges", "vul_no_logging_monitoring"]
  },
  {
    id: "thr_data_breach",
    name: "Data Breach",
    category: "Cyber",
    description: "Unauthorized access and exfiltration of sensitive information.",
    potentialImpact: "Results in regulatory fines and loss of reputation.",
    ciaTarget: "C",
    applicableAssetTypes: ["Database", "Cloud Resource", "Document", "Web Application"],
    vulnerabilityIds: ["vul_weak_access_control", "vul_publicly_exposed_database"]
  },
  {
    id: "thr_brute_force",
    name: "Brute Force",
    category: "Cyber",
    description: "Systematically guessing passwords until the correct one is found.",
    potentialImpact: "Leads to unauthorized account access.",
    ciaTarget: "C",
    applicableAssetTypes: ["Web Application", "Server", "API"],
    vulnerabilityIds: ["vul_weak_authentication", "vul_default_credentials"]
  },
  {
    id: "thr_supply_chain_attack",
    name: "Supply Chain Attack",
    category: "Cyber",
    description: "Compromising the organization through third-party vendors or software.",
    potentialImpact: "Bypasses internal defenses by exploiting trusted connections.",
    ciaTarget: "I",
    applicableAssetTypes: ["Cloud Resource", "API", "Server"],
    vulnerabilityIds: ["vul_no_vendor_review"]
  },
  {
    id: "thr_api_abuse",
    name: "API Abuse",
    category: "Cyber",
    description: "Exploiting vulnerabilities or design flaws in application programming interfaces.",
    potentialImpact: "Can cause data leakage or resource exhaustion.",
    ciaTarget: "A",
    applicableAssetTypes: ["API", "Web Application", "Mobile Application"],
    vulnerabilityIds: ["vul_insecure_api"]
  },
  {
    id: "thr_account_takeover",
    name: "Account Takeover",
    category: "Cyber",
    description: "Gaining unauthorized control over a legitimate user's account.",
    potentialImpact: "Enables identity theft and unauthorized transactions.",
    ciaTarget: "I",
    applicableAssetTypes: ["Web Application", "Mobile Application"],
    vulnerabilityIds: ["vul_missing_mfa", "vul_weak_authentication"]
  },
  {
    id: "thr_hardware_theft",
    name: "Hardware Theft",
    category: "Physical",
    description: "Stealing laptops, servers, or other physical devices.",
    potentialImpact: "Results in physical asset loss and potential data exposure.",
    ciaTarget: "C",
    applicableAssetTypes: ["Laptop", "Physical Equipment"],
    vulnerabilityIds: ["vul_no_physical_access_control"]
  },
  {
    id: "thr_fire",
    name: "Fire",
    category: "Environmental",
    description: "Fire breaking out in server rooms or data centers.",
    potentialImpact: "Causes permanent damage to hardware and data loss.",
    ciaTarget: "A",
    applicableAssetTypes: ["Physical Equipment", "Server", "Network Device"],
    vulnerabilityIds: ["vul_no_backup", "vul_no_incident_response_plan"]
  },
  {
    id: "thr_flood",
    name: "Flood",
    category: "Environmental",
    description: "Water damage affecting physical infrastructure.",
    potentialImpact: "Leads to hardware destruction and prolonged outages.",
    ciaTarget: "A",
    applicableAssetTypes: ["Physical Equipment", "Server", "Network Device"],
    vulnerabilityIds: ["vul_no_incident_response_plan", "vul_no_backup"]
  },
  {
    id: "thr_power_failure",
    name: "Power Failure",
    category: "Environmental",
    description: "Loss of electrical power to critical facilities.",
    potentialImpact: "Causes unexpected downtime and potential data corruption.",
    ciaTarget: "A",
    applicableAssetTypes: ["Physical Equipment", "Server", "Network Device"],
    vulnerabilityIds: ["vul_no_power_backup"]
  },
  {
    id: "thr_unauthorized_physical_access",
    name: "Unauthorized Physical Access",
    category: "Physical",
    description: "An intruder gaining entry to restricted areas.",
    potentialImpact: "Allows direct tampering with hardware or direct network connections.",
    ciaTarget: "C",
    applicableAssetTypes: ["Server", "Network Device", "Physical Equipment"],
    vulnerabilityIds: ["vul_no_physical_access_control", "vul_no_logging_monitoring"]
  },
  {
    id: "thr_data_tampering",
    name: "Data Tampering",
    category: "Cyber",
    description: "Malicious alteration of grades, financial records, or other critical data.",
    potentialImpact: "Compromises the integrity of university records.",
    ciaTarget: "I",
    applicableAssetTypes: ["Database", "Document", "Cloud Resource"],
    vulnerabilityIds: ["vul_weak_access_control", "vul_excessive_privileges"]
  },
  {
    id: "thr_misconfiguration",
    name: "Misconfiguration",
    category: "Human",
    description: "Errors in system or network settings exposing resources.",
    potentialImpact: "Creates unintended security holes that can be exploited.",
    ciaTarget: "C",
    applicableAssetTypes: ["Cloud Resource", "Server", "Network Device"],
    vulnerabilityIds: ["vul_publicly_exposed_database", "vul_default_credentials"]
  },
  {
    id: "thr_wifi_eavesdropping",
    name: "Wi-Fi Eavesdropping",
    category: "Cyber",
    description: "Intercepting wireless communications to steal data.",
    potentialImpact: "Leads to exposure of unencrypted credentials and sensitive data.",
    ciaTarget: "C",
    applicableAssetTypes: ["Network Device", "Laptop", "Mobile Application"],
    vulnerabilityIds: ["vul_unencrypted_wifi"]
  }
];
