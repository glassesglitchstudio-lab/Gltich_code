#include "UAnimRagdollComponent.h"
#include "Components/SkeletalMeshComponent.h"

UAnimRagdollComponent::UAnimRagdollComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

USkeletalMeshComponent* UAnimRagdollComponent::FindSkeletalMesh() const
{
    AActor* Owner = GetOwner();
    if (!Owner) return nullptr;
    return Owner->FindComponentByClass<USkeletalMeshComponent>();
}

void UAnimRagdollComponent::ActivateRagdoll()
{
    USkeletalMeshComponent* Mesh = FindSkeletalMesh();
    if (!Mesh)
    {
        UE_LOG(LogTemp, Warning, TEXT("AnimRagdoll: No SkeletalMeshComponent found"));
        return;
    }

    // Enable physics on all bodies
    Mesh->SetAllBodiesSimulatePhysics(true);
    Mesh->SetSimulatePhysics(true);
    Mesh->WakeAllRigidBodies();

    // Set collision enabled for physics
    Mesh->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    Mesh->SetCollisionObjectType(ECC_PhysicsBody);
    Mesh->SetCollisionResponseToAllChannels(ECR_Block);

    // Apply damping if configured
    if (LinearDamping > 0.0f || AngularDamping > 0.0f)
    {
        Mesh->SetLinearDamping(LinearDamping);
        Mesh->SetAngularDamping(AngularDamping);
    }

    // Gravity
    Mesh->SetEnableGravity(bEnableGravity);

    bIsRagdollActive = true;
    BlendAlpha = 1.0f;

    UE_LOG(LogTemp, Log, TEXT("AnimRagdoll: Activated (weight=%.2f)"), RagdollWeight);
}

void UAnimRagdollComponent::DeactivateRagdoll()
{
    USkeletalMeshComponent* Mesh = FindSkeletalMesh();
    if (!Mesh)
    {
        UE_LOG(LogTemp, Warning, TEXT("AnimRagdoll: No SkeletalMeshComponent found"));
        return;
    }

    // Disable physics on all bodies
    Mesh->SetAllBodiesSimulatePhysics(false);
    Mesh->SetSimulatePhysics(false);
    Mesh->PutAllBodiesToSleep();

    // Restore collision
    Mesh->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    Mesh->SetCollisionObjectType(ECC_Pawn);
    Mesh->SetCollisionResponseToAllChannels(ECR_Overlap);

    bIsRagdollActive = false;
    BlendAlpha = 0.0f;

    UE_LOG(LogTemp, Log, TEXT("AnimRagdoll: Deactivated"));
}

void UAnimRagdollComponent::SetWeight(float Weight)
{
    RagdollWeight = FMath::Clamp(Weight, 0.0f, 1.0f);

    USkeletalMeshComponent* Mesh = FindSkeletalMesh();
    if (Mesh)
    {
        // Set physics weight per body — lower weight = less physics influence
        Mesh->SetAllBodiesBelowSimulatePhysics(NAME_None, RagdollWeight > 0.0f);
    }

    UE_LOG(LogTemp, Log, TEXT("AnimRagdoll: Weight set to %.2f"), RagdollWeight);
}

void UAnimRagdollComponent::BlendRagdoll(float BlendTime)
{
    BlendDuration = FMath::Max(BlendTime, 0.01f);
    BlendTimer = 0.0f;
    bBlending = true;

    UE_LOG(LogTemp, Log, TEXT("AnimRagdoll: Blending over %.2fs"), BlendTime);
}

void UAnimRagdollComponent::ApplyImpulse(float Force, const FVector& Direction, const FName& BoneName)
{
    USkeletalMeshComponent* Mesh = FindSkeletalMesh();
    if (!Mesh)
    {
        UE_LOG(LogTemp, Warning, TEXT("AnimRagdoll: No SkeletalMeshComponent found"));
        return;
    }

    FVector Impulse = Direction.GetSafeNormal() * Force;

    if (BoneName != NAME_None)
    {
        // Apply impulse to specific bone
        Mesh->AddImpulse(Impulse, BoneName, true);
    }
    else
    {
        // Apply impulse to all bodies
        Mesh->AddImpulseToAllBodies(Impulse, false, true);
    }

    UE_LOG(LogTemp, Log, TEXT("AnimRagdoll: Impulse %.1f -> %s (bone: %s)"),
        Force, *Impulse.ToString(), *BoneName.ToString());
}

void UAnimRagdollComponent::ApplyRadialImpulse(const FVector& Origin, float Force, float Radius)
{
    USkeletalMeshComponent* Mesh = FindSkeletalMesh();
    if (!Mesh)
    {
        return;
    }

    Mesh->AddRadialImpulseToAllBodies(Origin, Radius, Force, ERadialImpulseFalloff::RIF_Linear, false);
}

void UAnimRagdollComponent::SetAllBodiesBelowSimulatePhysics(const FName& BoneName, bool bNewSimulate, bool bIncludeSelf)
{
    USkeletalMeshComponent* Mesh = FindSkeletalMesh();
    if (Mesh)
    {
        Mesh->SetAllBodiesBelowSimulatePhysics(BoneName, bNewSimulate, bIncludeSelf);
    }
}

void UAnimRagdollComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (bBlending && bIsRagdollActive)
    {
        BlendTimer += DeltaTime;
        BlendAlpha = FMath::Clamp(BlendTimer / BlendDuration, 0.0f, 1.0f);

        USkeletalMeshComponent* Mesh = FindSkeletalMesh();
        if (Mesh)
        {
            // Apply blend weight to physics bodies
            Mesh->SetAllBodiesSimulatePhysics(BlendAlpha > 0.0f);
        }

        if (BlendAlpha >= 1.0f)
        {
            bBlending = false;
        }
    }
}
