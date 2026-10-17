import { createFileRoute } from '@tanstack/react-router';

import { ProseItem, ProseList, ProsePage, ProseParagraph, ProseSection } from '~/components/prose';

const LAST_UPDATED = 'October 17, 2026';

function TermsPage() {
	return (
		<ProsePage
			title='Terms of Service'
			description='Please read these terms carefully before using Unbound.'
			footer={`Last updated: ${LAST_UPDATED}`}
		>
			<ProseSection title='Acceptance of Terms'>
				<ProseParagraph>
					By accessing or using Unbound, you agree to be bound by these Terms of Service
					and all applicable laws and regulations. If you do not agree with any of these
					terms, you are prohibited from using or accessing this service.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='Discord Terms of Service Violation'>
				<ProseParagraph>
					Unbound is a client modification for Discord. You explicitly acknowledge and
					understand that:
				</ProseParagraph>
				<ProseList>
					<ProseItem>
						Using client modifications violates Discord's Terms of Service
					</ProseItem>
					<ProseItem>
						Your Discord account may be suspended, banned, or terminated at any time for
						using Unbound
					</ProseItem>
					<ProseItem>
						Discord does not endorse, support, or approve of Unbound in any way
					</ProseItem>
					<ProseItem>You use Unbound entirely at your own risk</ProseItem>
				</ProseList>
			</ProseSection>

			<ProseSection title='User Accounts'>
				<ProseParagraph>
					To access certain features of Unbound, you may be required to create an account.
					You agree to:
				</ProseParagraph>
				<ProseList>
					<ProseItem>
						Provide accurate, current, and complete information during registration
					</ProseItem>
					<ProseItem>Maintain and promptly update your account information</ProseItem>
					<ProseItem>Maintain the security of your account credentials</ProseItem>
					<ProseItem>
						Accept responsibility for all activities that occur under your account
					</ProseItem>
					<ProseItem>
						Notify us immediately of any unauthorized use of your account
					</ProseItem>
				</ProseList>
			</ProseSection>

			<ProseSection title='User Content and Submissions'>
				<ProseParagraph>
					When you submit plugins, themes, or other content to Unbound, you agree that:
				</ProseParagraph>
				<ProseList>
					<ProseItem>
						You own or have the necessary rights to submit the content
					</ProseItem>
					<ProseItem>
						Your content does not violate any third-party rights, including intellectual
						property rights
					</ProseItem>
					<ProseItem>
						Your content does not contain malicious code, viruses, or other harmful
						components
					</ProseItem>
					<ProseItem>
						You grant Unbound a non-exclusive, worldwide, royalty-free license to host,
						distribute, and display your content
					</ProseItem>
					<ProseItem>
						We reserve the right to remove any content that violates these terms or is
						deemed inappropriate
					</ProseItem>
				</ProseList>
			</ProseSection>

			<ProseSection title='Prohibited Activities'>
				<ProseParagraph>
					You agree not to engage in any of the following activities:
				</ProseParagraph>
				<ProseList>
					<ProseItem>
						Submitting malicious code, malware, or content designed to harm users or
						systems
					</ProseItem>
					<ProseItem>
						Attempting to gain unauthorized access to our systems or other users'
						accounts
					</ProseItem>
					<ProseItem>Harassing, threatening, or impersonating other users</ProseItem>
					<ProseItem>Violating any applicable laws or regulations</ProseItem>
					<ProseItem>
						Scraping, data mining, or harvesting data from Unbound without permission
					</ProseItem>
					<ProseItem>Interfering with or disrupting the service or servers</ProseItem>
				</ProseList>
			</ProseSection>

			<ProseSection title='Intellectual Property'>
				<ProseParagraph>
					The Unbound platform, including its design, code, and original content, is owned
					by Unbound and protected by intellectual property laws. You may not copy,
					modify, distribute, or reverse engineer any part of the platform without
					explicit permission.
				</ProseParagraph>
				<ProseParagraph>
					User-submitted plugins and themes remain the property of their respective
					creators, subject to the license terms they choose to apply.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='Disclaimer of Warranties'>
				<ProseParagraph>
					Unbound is provided "as is" and "as available" without warranties of any kind,
					either express or implied, including but not limited to:
				</ProseParagraph>
				<ProseList>
					<ProseItem>
						Warranties of merchantability, fitness for a particular purpose, or
						non-infringement
					</ProseItem>
					<ProseItem>
						Warranties that the service will be uninterrupted, secure, or error-free
					</ProseItem>
					<ProseItem>
						Warranties regarding the accuracy, reliability, or quality of any content or
						plugins
					</ProseItem>
				</ProseList>
			</ProseSection>

			<ProseSection title='Limitation of Liability'>
				<ProseParagraph>
					To the maximum extent permitted by law, Unbound and its developers shall not be
					liable for any indirect, incidental, special, consequential, or punitive
					damages, including but not limited to:
				</ProseParagraph>
				<ProseList>
					<ProseItem>Loss of data, profits, or goodwill</ProseItem>
					<ProseItem>Service interruptions or system failures</ProseItem>
					<ProseItem>Discord account suspensions, bans, or terminations</ProseItem>
					<ProseItem>
						Damage caused by plugins, themes, or content submitted by users
					</ProseItem>
					<ProseItem>Any other damages arising from your use of Unbound</ProseItem>
				</ProseList>
			</ProseSection>

			<ProseSection title='Indemnification'>
				<ProseParagraph>
					You agree to indemnify, defend, and hold harmless Unbound, its developers, and
					affiliates from any claims, damages, losses, liabilities, and expenses
					(including legal fees) arising from:
				</ProseParagraph>
				<ProseList>
					<ProseItem>Your use of Unbound</ProseItem>
					<ProseItem>Your violation of these Terms of Service</ProseItem>
					<ProseItem>Your violation of any third-party rights</ProseItem>
					<ProseItem>Content you submit to the platform</ProseItem>
				</ProseList>
			</ProseSection>

			<ProseSection title='Termination'>
				<ProseParagraph>
					We reserve the right to suspend or terminate your account and access to Unbound
					at any time, without notice, for any reason, including but not limited to
					violations of these Terms of Service. Upon termination, your right to use the
					service will immediately cease.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='Changes to Terms'>
				<ProseParagraph>
					We reserve the right to modify these Terms of Service at any time. Changes will
					be effective immediately upon posting to this page. Your continued use of
					Unbound after changes are posted constitutes acceptance of the modified terms.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='Governing Law'>
				<ProseParagraph>
					These Terms of Service shall be governed by and construed in accordance with
					applicable laws, without regard to conflict of law principles. Any disputes
					arising from these terms or your use of Unbound shall be resolved in accordance
					with such laws.
				</ProseParagraph>
			</ProseSection>

			<ProseSection title='Contact'>
				<ProseParagraph>
					If you have any questions about these Terms of Service, please contact us
					through our Discord server or GitHub repository.
				</ProseParagraph>
			</ProseSection>
		</ProsePage>
	);
}

export const Route = createFileRoute('/_site/terms')({
	head: () => ({ meta: [{ title: 'Unbound | Terms & Conditions' }] }),
	component: TermsPage,
});
