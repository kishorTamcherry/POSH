/**
 * Official POSH training content for SFO Technologies (from POSH Script.docx).
 * Delivered conversationally: one section per turn with check-ins, not as a single monologue.
 */
export const POSH_TRAINING_SECTIONS = [
  {
    title: "Welcome, purpose, and zero tolerance",
    body: `Hello and welcome to your POSH training session. POSH stands for Prevention of Sexual Harassment at Workplace. At SFO Technologies, we follow a strict zero-tolerance approach toward harassment, abuse, intimidation, or any inappropriate behavior. This session will guide you through your rights, responsibilities, and the support systems available to you. Our goal is simple: every person should feel safe, respected, and valued at work, regardless of role, gender, or level.`,
  },
  {
    title: "Objectives and legal framework",
    body: `The objective of this training is to build practical awareness of what sexual harassment is, how to prevent it, and how to report concerns safely and confidentially. Our policy is aligned with the Sexual Harassment of Women at Workplace Act, 2013. It ensures that employees have access to a fair, respectful, and time-bound grievance redressal process. Compliance is not only a legal requirement, but also a commitment to ethical and professional workplace standards.`,
  },
  {
    title: "Coverage and workplace scope",
    body: `This policy applies to everyone associated with the organization, including employees, trainees, interns, contract workers, consultants, vendors, and visitors. The workplace is not limited to office premises. It also includes client locations, official travel, offsite events, and virtual platforms such as calls, chats, emails, and collaboration tools where work interactions happen. Respectful conduct is expected in all these environments.`,
  },
  {
    title: "What harassment means and key terms",
    body: `Sexual harassment is any unwelcome behavior of a sexual nature. This can include physical acts, verbal remarks or jokes, suggestive comments, non-verbal gestures, messages, stalking, intimidation, or misuse of authority. The key test is whether the behavior is unwelcome and impacts dignity, safety, or comfort. Harassment can also include non-sexual abuse, such as bullying, threats, or psychological mistreatment. In this policy, an aggrieved woman is any woman who experiences harassment at work, and the respondent is the person against whom a complaint is made.`,
  },
  {
    title: "Responsibilities of employees, managers, and HR",
    body: `Creating a respectful workplace is a shared responsibility. Employees are expected to maintain professional conduct, avoid inappropriate behavior, and report concerns they experience or witness. Managers and supervisors have additional responsibility to set the right tone, respond promptly, and prevent retaliation or victimization. HR and leadership must ensure policy implementation, regular awareness, and fair, confidential handling of every complaint from start to closure.`,
  },
  {
    title: "Reporting channels and ICC",
    body: `If you experience or witness harassment, you can report to HR, your manager, or the Internal Complaints Committee, known as the ICC, through written complaint, verbal reporting, or email. The ICC includes a senior woman Presiding Officer, internal members, and an external member, with at least half the members being women. The ICC is responsible for receiving complaints, conducting a fair inquiry, and recommending action, while ensuring confidentiality and impartiality throughout.`,
  },
  {
    title: "Complaint process and timeline",
    body: `The process begins with filing a complaint, ideally within three months of the incident, with extension possible in valid circumstances. After acknowledgment and preliminary review, conciliation may be attempted if requested by the complainant, but without monetary settlement. If conciliation is not suitable or does not resolve the matter, a formal inquiry is conducted, giving both parties a fair opportunity to be heard. The inquiry is completed within prescribed timelines, and the employer acts on the ICC recommendations.`,
  },
  {
    title: "Outcomes, safeguards, and support",
    body: `If a complaint is proven, actions may include warning, suspension, termination, or other corrective measures. If a complaint is not substantiated, no punitive action is taken. False complaints are addressed only when proven malicious, and not merely due to insufficient evidence. Confidentiality of the complainant, respondent, and witnesses is protected, and retaliation is strictly prohibited. Support options may include counselling, medical assistance, safety planning, and temporary workplace adjustments when required.`,
  },
  {
    title: "Closing reminder and conduct expectations",
    body: `To conclude, a safe workplace is built through awareness, respect, and accountability. Harassment in any form is unacceptable. Public humiliation, coercion, threats, exclusion, and denial of dignity are strictly prohibited. Every employee has both a right to a safe workplace and a responsibility to maintain it through respectful behavior, bystander responsibility, and timely reporting of concerns.`,
  },
  {
    title: "Doubts and questions",
    body: `Thank you for your time and attention. Before we finish, do you have any doubts or anything you would like me to clarify? Please feel free to ask any questions.`,
  },
];

/** Full reference text (all sections joined). */
export const POSH_TRAINING_SCRIPT = POSH_TRAINING_SECTIONS.map((s) => s.body).join("\n\n");
