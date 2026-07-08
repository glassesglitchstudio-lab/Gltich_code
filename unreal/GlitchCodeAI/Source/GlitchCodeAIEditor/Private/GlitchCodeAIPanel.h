#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"
#include "Widgets/Views/SListView.h"

struct FChatMessage
{
	FString Sender;
	FString Content;
	FDateTime Timestamp;
	bool bIsUser;

	FChatMessage() : Timestamp(FDateTime::Now()), bIsUser(true) {}
	FChatMessage(const FString& InSender, const FString& InContent, bool bInIsUser)
		: Sender(InSender)
		, Content(InContent)
		, Timestamp(FDateTime::Now())
		, bIsUser(bInIsUser)
	{
	}
};

class SGlitchCodeAIPanel : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SGlitchCodeAIPanel) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

private:
	void OnSendClicked();
	void OnTextCommitted(const FText& Text, ETextCommit::Type CommitType);
	void OnResponseReceived(const FString& Response);
	void OnErrorReceived(const FString& ErrorMessage);
	void AddMessage(const FString& Sender, const FString& Content, bool bIsUser);
	void ScrollToBottom();

	TSharedPtr<SScrollBox> ChatScrollBox;
	TSharedPtr<SEditableTextBox> InputTextBox;
	TSharedPtr<SListView<TSharedPtr<FChatMessage>>> MessageListView;
	TArray<TSharedPtr<FChatMessage>> Messages;
};
