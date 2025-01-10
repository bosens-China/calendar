import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { removeRecordTag } from '@/store/slice/record';
import { removeRole, selectRole, setCurrentRole } from '@/store/slice/role';
import { deleteBasedOnRole, selectTag } from '@/store/slice/tag';

export const useDelete = () => {
  const dispatch = useAppDispatch();
  const { tags } = useAppSelector(selectTag);
  const { currentRole } = useAppSelector(selectRole);
  const deleteRole = (id: string) => {
    dispatch(removeRole(id));
    const toBeDeletedTags = Object.values(tags)
      .filter((f) => f.roleId === id)
      .map((f) => f.id);
    dispatch(deleteBasedOnRole(id));
    toBeDeletedTags.forEach((id) => {
      dispatch(removeRecordTag(id));
    });
    // 检查选择的角色是不是包含当前
    dispatch(setCurrentRole(currentRole.filter((f) => f !== id)));
  };

  return {
    deleteRole,
  };
};
