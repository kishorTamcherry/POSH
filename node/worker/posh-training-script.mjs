/**
 * Official POSH training content for SFO Technologies (from POSH Script.docx).
 * Delivered conversationally: one section per turn with check-ins, not as a single monologue.
 */
export const POSH_TRAINING_SECTIONS = [
  {
    title: "Welcome and session purpose",
    body: `Hello and welcome to your POSH training session. POSH stands for Prevention of Sexual Harassment at Workplace. This session is designed to help you understand your rights, your responsibilities, and the systems in place to ensure a safe, respectful, and dignified workplace for everyone at SFO Technologies.`,
  },
  {
    title: "Zero tolerance and workplace culture",
    body: `At SFO Technologies, we follow a strict zero-tolerance approach towards any form of harassment, abuse, intimidation, or inappropriate behavior. Every individual in the workplace is expected to uphold dignity, mutual respect, and professional conduct at all times. This is not just a policy requirement, but a shared responsibility that defines our workplace culture.`,
  },
  {
    title: "Training objectives and legal alignment",
    body: `The objective of this training is to create awareness about what constitutes sexual harassment, how it can be prevented, and how concerns can be reported safely and confidentially. This policy is aligned with the Sexual Harassment of Women at Workplace Act, 2013, and ensures that every employee has access to a fair and time-bound grievance redressal mechanism.`,
  },
  {
    title: "Who the policy covers and where it applies",
    body: `This policy applies to everyone associated with the organization, including employees, trainees, interns, contract workers, consultants, vendors, and visitors. It also applies across all workplace settings, whether you are in the office, at a client location, traveling for work, or interacting through virtual platforms.`,
  },
  {
    title: "What sexual harassment means",
    body: `Let us now understand what sexual harassment means. Sexual harassment refers to any unwelcome behavior of a sexual nature. This may include physical actions, verbal comments or jokes, non-verbal gestures, messages, or any form of communication that makes a person feel uncomfortable, unsafe, or disrespected. It can also include stalking, intimidation, or misuse of authority. The key factor here is whether the behavior is unwelcome. If it is unwelcome and affects someone's dignity or comfort, it may be considered harassment.`,
  },
  {
    title: "Other forms of harassment",
    body: `It is also important to understand that harassment is not limited to sexual behavior. The organization strictly prohibits all forms of abuse, including physical abuse, verbal harassment, psychological harassment, bullying, threats, or intimidation. Any such behavior is unacceptable and will be treated seriously.`,
  },
  {
    title: "Key terms",
    body: `In this context, there are a few key terms to understand. An aggrieved woman is any woman who experiences harassment at the workplace. The respondent is the person against whom the complaint is made. The workplace includes not only physical office spaces but also any location or situation connected to work, including virtual interactions.`,
  },
  {
    title: "Shared responsibilities",
    body: `Creating a respectful workplace is a shared responsibility. As an employee, you are expected to treat others with respect, avoid any behavior that could be perceived as harassment, and report any inappropriate conduct that you experience or witness. Managers and supervisors have an added responsibility to ensure a safe working environment, take complaints seriously, and prevent any form of retaliation or victimization. The organization and HR team are responsible for implementing policies, conducting training, and ensuring that complaints are handled fairly and confidentially.`,
  },
  {
    title: "How to report",
    body: `If you experience or witness harassment, there are multiple ways to report it. You can reach out to the HR department, your manager, or the Internal Complaints Committee, also known as the ICC. Complaints can be made in writing, verbally, or through email. The organization ensures that all complaints are handled with strict confidentiality and without any risk of retaliation.`,
  },
  {
    title: "The Internal Complaints Committee (ICC)",
    body: `The Internal Complaints Committee is a formal body established to address sexual harassment complaints. It includes a senior woman employee as the Presiding Officer, along with internal and external members, and ensures that at least half of its members are women. The ICC is responsible for receiving complaints, conducting inquiries, and recommending appropriate actions, while maintaining complete confidentiality throughout the process.`,
  },
  {
    title: "Complaint process and timeline",
    body: `The complaint process begins with filing a complaint, ideally within three months of the incident, although extensions may be allowed in certain cases. Once a complaint is received, it is acknowledged within a defined timeframe, and a preliminary review is conducted to determine the appropriate course of action. If the complainant requests, a conciliation process may be attempted, provided there is no monetary settlement involved. If conciliation is not suitable or does not resolve the issue, a formal inquiry is conducted, ensuring a fair hearing for both parties. The inquiry is completed within a prescribed timeline, and based on the findings, appropriate actions are taken by the employer.`,
  },
  {
    title: "Outcomes and false complaints",
    body: `If a complaint is proven, disciplinary actions may include warnings, suspension, termination, or corrective training. If the complaint is not substantiated, no action is taken. It is also important to note that false complaints are treated seriously only if they are proven to be malicious, and not simply because there is insufficient evidence.`,
  },
  {
    title: "Confidentiality and non-retaliation",
    body: `The organization places strong emphasis on confidentiality and non-retaliation. The identity of the complainant, respondent, and witnesses is protected, and any breach of confidentiality or retaliation against individuals involved in a complaint will lead to disciplinary action.`,
  },
  {
    title: "Support available",
    body: `Support is also available for individuals who experience harassment. This includes access to counselling, medical assistance if required, protection from retaliation, and temporary workplace adjustments to ensure safety and well-being.`,
  },
  {
    title: "Disciplinary principles",
    body: `In addition, the organization follows strict disciplinary principles. Practices such as public humiliation, threats, coercion, or denial of basic facilities are strictly prohibited. Disciplinary actions are applied fairly, consistently, and without discrimination.`,
  },
  {
    title: "Closing reminder",
    body: `As we conclude this session, remember that a safe workplace is built on awareness, respect, and accountability. Harassment of any kind is not acceptable. You have the right to work in a safe environment, and you also have the responsibility to contribute to that environment.`,
  },
  {
    title: "Doubts and questions",
    body: `Thank you for your time and attention. Before we finish, do you have any doubts or anything you would like me to clarify? Please feel free to ask any questions.`,
  },
];

/** Full reference text (all sections joined). */
export const POSH_TRAINING_SCRIPT = POSH_TRAINING_SECTIONS.map((s) => s.body).join("\n\n");
