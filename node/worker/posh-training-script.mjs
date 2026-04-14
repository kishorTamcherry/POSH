/**
 * Official POSH training content for SFO Technologies (from POSH Script.docx).
 * Delivered conversationally: one section per turn with check-ins, not as a single monologue.
 */
export const POSH_TRAINING_SECTIONS = [
  {
    title: "Welcome, purpose, and zero tolerance",
    body: `Hello and welcome to your POSH training session. POSH stands for Prevention of Sexual Harassment at Workplace. At SFO Technologies, we follow a strict zero-tolerance approach toward harassment, abuse, intimidation, or any inappropriate behavior. This session helps you understand your rights, responsibilities, and the systems that protect a safe, respectful, and dignified workplace for everyone.`,
  },
  {
    title: "Objectives and legal framework",
    body: `The objective of this training is to build awareness of what sexual harassment is, how it can be prevented, and how concerns can be reported safely and confidentially. Our policy aligns with the Sexual Harassment of Women at Workplace Act, 2013, and provides a fair, confidential, and time-bound grievance redressal mechanism.`,
  },
  {
    title: "Coverage and workplace scope",
    body: `This policy applies to everyone associated with the organization, including employees, trainees, interns, contract workers, consultants, vendors, and visitors. The workplace includes office locations, client sites, work travel, and virtual platforms where work interactions happen.`,
  },
  {
    title: "What harassment means and key terms",
    body: `Sexual harassment is any unwelcome behavior of a sexual nature, including physical acts, verbal remarks or jokes, non-verbal gestures, messages, stalking, intimidation, or misuse of authority. The key test is whether the behavior is unwelcome and affects dignity, safety, or comfort. Harassment also includes non-sexual abuse such as bullying, threats, verbal, physical, or psychological harassment. Key terms: an aggrieved woman is any woman experiencing harassment at work, and the respondent is the person against whom a complaint is made.`,
  },
  {
    title: "Responsibilities of employees, managers, and HR",
    body: `Creating a respectful workplace is a shared responsibility. Employees must maintain respectful conduct and report inappropriate behavior they experience or witness. Managers and supervisors must ensure a safe environment, respond seriously to complaints, and prevent retaliation or victimization. HR and the organization must implement policy, conduct awareness and training, and ensure fair and confidential handling of all complaints.`,
  },
  {
    title: "Reporting channels and ICC",
    body: `If you experience or witness harassment, you can report to HR, your manager, or the Internal Complaints Committee, known as the ICC, via written complaint, verbal reporting, or email. The ICC includes a senior woman Presiding Officer, internal members, and an external member, with at least half the members being women. The ICC receives complaints, conducts inquiry, and recommends action while maintaining confidentiality.`,
  },
  {
    title: "Complaint process and timeline",
    body: `The process starts with filing a complaint, ideally within three months of the incident, with extension possible in valid cases. After acknowledgment and initial review, conciliation may be attempted if requested by the complainant, but without monetary settlement. If conciliation is not suitable or fails, a formal inquiry is conducted with fair hearing to both parties. The inquiry is completed within prescribed timelines, and the employer acts on findings.`,
  },
  {
    title: "Outcomes, safeguards, and support",
    body: `If a complaint is proven, actions may include warning, suspension, termination, or corrective measures. If not substantiated, no punitive action is taken. False complaints are acted on only when proven malicious, not merely due to lack of evidence. Identities of complainant, respondent, and witnesses are protected, and retaliation or breach of confidentiality attracts disciplinary action. Support such as counselling, medical help, safety measures, and temporary workplace adjustments is available where needed.`,
  },
  {
    title: "Closing reminder and conduct expectations",
    body: `To conclude, a safe workplace is built through awareness, respect, and accountability. Harassment in any form is unacceptable. Public humiliation, coercion, threats, and denial of basic dignity are strictly prohibited. You have the right to a safe workplace and the responsibility to help maintain it through respectful behavior and timely reporting.`,
  },
  {
    title: "Doubts and questions",
    body: `Thank you for your time and attention. Before we finish, do you have any doubts or anything you would like me to clarify? Please feel free to ask any questions.`,
  },
];

/** Full reference text (all sections joined). */
export const POSH_TRAINING_SCRIPT = POSH_TRAINING_SECTIONS.map((s) => s.body).join("\n\n");
