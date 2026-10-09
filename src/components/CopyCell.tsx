import { Button, Flex, FlexItem, Truncate } from '@patternfly/react-core';
import { CopyIcon } from '@patternfly/react-icons';
import { useState, type FC } from 'react';

interface CopyCellProps {
  text: string;
  emptyText?: string;
}

const CopyCell: FC<CopyCellProps> = ({ text, emptyText = '—' }) => {
  const [copied, setCopied] = useState(false);

  if (!text) {
    return <span>{emptyText}</span>;
  }

  const onCopy = () => {
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => {
          setCopied(false);
        }, 1500);
      })
      .catch(() => {
        // ignore clipboard failures
      });
  };

  return (
    <Flex
      spaceItems={{ default: 'spaceItemsSm' }}
      flexWrap={{ default: 'nowrap' }}
      alignItems={{ default: 'alignItemsCenter' }}
    >
      <FlexItem style={{ minWidth: 0, maxWidth: '28rem' }}>
        <span className="kubevirt-hosts__mono" title={text}>
          <Truncate content={text} />
        </span>
      </FlexItem>
      <FlexItem>
        <Button
          variant="plain"
          aria-label={copied ? 'Copied' : 'Copy to clipboard'}
          onClick={onCopy}
          icon={<CopyIcon />}
        />
      </FlexItem>
    </Flex>
  );
};

export default CopyCell;
